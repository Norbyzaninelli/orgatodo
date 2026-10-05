import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { toWhatsappNumber } from "./phone";

type Kind = (typeof schema.notificationKind.enumValues)[number];
type NewNotification = typeof schema.notifications.$inferInsert;

export type BookingEvent = "creado" | "confirmado" | "cancelado_por_cliente" | "cancelado_por_profesional";

/** No se programa un recordatorio que saldría con menos de este margen. */
const MIN_REMINDER_LEAD_MS = 30 * 60_000;

async function loadBooking(bookingId: string) {
  const [row] = await db
    .select({ booking: schema.bookings, professional: schema.professionals, client: schema.clients })
    .from(schema.bookings)
    .innerJoin(schema.professionals, eq(schema.bookings.professionalId, schema.professionals.id))
    .innerJoin(schema.clients, eq(schema.bookings.clientId, schema.clients.id))
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);
  return row ?? null;
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

function forClient(row: Loaded, kind: Kind, scheduledAt?: Date): NewNotification[] {
  const out: NewNotification[] = [
    { bookingId: row.booking.id, kind, channel: "email", recipient: "cliente", address: row.client.email, scheduledAt },
  ];
  const phone = toWhatsappNumber(row.client.phone);
  if (phone) out.push({ bookingId: row.booking.id, kind, channel: "whatsapp", recipient: "cliente", address: phone, scheduledAt });
  return out;
}

function forProfessional(row: Loaded, kind: Kind): NewNotification[] {
  const out: NewNotification[] = [];
  const pro = row.professional;
  if (pro.notifyByEmail) {
    out.push({ bookingId: row.booking.id, kind, channel: "email", recipient: "profesional", address: pro.email });
  }
  const phone = toWhatsappNumber(pro.phone);
  if (pro.notifyByWhatsapp && phone) {
    out.push({ bookingId: row.booking.id, kind, channel: "whatsapp", recipient: "profesional", address: phone });
  }
  return out;
}

/** Programa los avisos que corresponden a un cambio en un turno. */
export async function enqueueBookingEvent(bookingId: string, event: BookingEvent, now = new Date()) {
  const row = await loadBooking(bookingId);
  if (!row) return;
  const rows: NewNotification[] = [];

  if (event === "creado") {
    const confirmed = row.booking.status === "confirmado";
    rows.push(...forClient(row, confirmed ? "turno_confirmado" : "reserva_recibida"));
    rows.push(...forProfessional(row, "nuevo_turno"));
    const hours = row.professional.reminderHoursBefore;
    if (hours > 0) {
      const at = new Date(row.booking.startsAt.getTime() - hours * 3_600_000);
      if (at.getTime() - now.getTime() >= MIN_REMINDER_LEAD_MS) rows.push(...forClient(row, "recordatorio", at));
    }
  } else if (event === "confirmado") {
    rows.push(...forClient(row, "turno_confirmado"));
  } else {
    // Si el turno se cancela, el recordatorio pendiente ya no tiene sentido.
    await db
      .update(schema.notifications)
      .set({ status: "omitido" })
      .where(
        and(
          eq(schema.notifications.bookingId, bookingId),
          eq(schema.notifications.kind, "recordatorio"),
          eq(schema.notifications.status, "pendiente"),
        ),
      );
    rows.push(
      ...(event === "cancelado_por_cliente"
        ? forProfessional(row, "cancelado_por_cliente")
        : forClient(row, "cancelado_por_profesional")),
    );
  }

  if (rows.length > 0) await db.insert(schema.notifications).values(rows).onConflictDoNothing();
}
