import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { bookableRange, loadSlotInput } from "./queries";
import { isSlotAvailable, toLocalDate } from "./slots";

export const bookingRequestSchema = z.object({
  professionalSlug: z.string().min(1),
  serviceId: z.uuid(),
  startsAt: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(2, "Ingresá tu nombre").max(120),
  email: z.email("Ingresá un email válido").trim().toLowerCase(),
  phone: z.string().trim().min(6, "Ingresá un teléfono").max(30),
  notes: z.string().trim().max(500).optional(),
});

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export class BookingError extends Error {
  constructor(
    public readonly code: "not_found" | "slot_taken" | "out_of_range",
    message: string,
  ) {
    super(message);
  }
}

/** Código de Postgres cuando se viola la restricción que impide turnos superpuestos. */
const EXCLUSION_VIOLATION = "23P01";

export function isExclusionViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    if ("code" in current && (current as { code?: string }).code === EXCLUSION_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function createBooking(request: BookingRequest, now = new Date()) {
  const professional = await db.query.professionals.findFirst({
    where: and(
      eq(schema.professionals.slug, request.professionalSlug),
      eq(schema.professionals.published, true),
    ),
  });
  if (!professional) throw new BookingError("not_found", "El profesional no existe");

  const service = await db.query.services.findFirst({
    where: and(
      eq(schema.services.id, request.serviceId),
      eq(schema.services.professionalId, professional.id),
      eq(schema.services.active, true),
    ),
  });
  if (!service) throw new BookingError("not_found", "El servicio no existe");

  const startsAt = new Date(request.startsAt);
  const date = toLocalDate(startsAt, professional.timezone);
  const range = bookableRange(professional, now, professional.maxDaysAhead);
  if (date < range.from || date > range.to) {
    throw new BookingError("out_of_range", "Esa fecha no está disponible para reservar");
  }

  const input = await loadSlotInput(professional, service, date, date, now);
  if (!isSlotAvailable(input, startsAt)) {
    throw new BookingError("slot_taken", "Ese horario ya no está disponible");
  }

  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

  try {
    return await db.transaction(async (tx) => {
      const [client] = await tx
        .insert(schema.clients)
        .values({
          professionalId: professional.id,
          name: request.name,
          email: request.email,
          phone: request.phone,
        })
        .onConflictDoUpdate({
          target: [schema.clients.professionalId, schema.clients.email],
          set: { name: request.name, phone: request.phone, updatedAt: sql`now()` },
        })
        .returning({ id: schema.clients.id });

      const [booking] = await tx
        .insert(schema.bookings)
        .values({
          professionalId: professional.id,
          serviceId: service.id,
          clientId: client.id,
          startsAt,
          endsAt,
          status: professional.autoConfirm ? "confirmado" : "reservado",
          serviceName: service.name,
          priceCents: service.priceCents,
          notes: request.notes || null,
        })
        .returning();
      return booking;
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new BookingError("slot_taken", "Ese horario ya no está disponible");
    }
    throw error;
  }
}

export async function getBookingByToken(token: string) {
  const [row] = await db
    .select({
      booking: schema.bookings,
      professional: schema.professionals,
      client: schema.clients,
    })
    .from(schema.bookings)
    .innerJoin(schema.professionals, eq(schema.bookings.professionalId, schema.professionals.id))
    .innerJoin(schema.clients, eq(schema.bookings.clientId, schema.clients.id))
    .where(eq(schema.bookings.manageToken, token))
    .limit(1);
  return row ?? null;
}

/** El cliente cancela desde su link. Solo turnos futuros que sigan activos. Devuelve el id cancelado. */
export async function cancelBookingByToken(token: string, now = new Date()): Promise<string | null> {
  const updated = await db
    .update(schema.bookings)
    .set({ status: "cancelado", cancelledAt: now })
    .where(
      and(
        eq(schema.bookings.manageToken, token),
        inArray(schema.bookings.status, ["reservado", "confirmado"]),
        gt(schema.bookings.startsAt, now),
      ),
    )
    .returning({ id: schema.bookings.id });
  return updated[0]?.id ?? null;
}
