import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatLongDate, formatTime } from "@/lib/format";
import { buildMessage, textToHtml, type MessageContext } from "./messages";
import { sendEmail, sendWhatsapp } from "./providers";

const MAX_ATTEMPTS = 5;
/** Mientras se manda un aviso queda reservado este tiempo, para que otro proceso no lo repita. */
const LEASE_MINUTES = 10;

export function appUrl(): string {
  return (process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Toma avisos vencidos y los marca como reservados en una sola consulta. */
async function claimDue(limit: number) {
  const result = await db.execute<{ id: string }>(sql`
    update ${schema.notifications}
    set scheduled_at = now() + make_interval(mins => ${LEASE_MINUTES}), attempts = attempts + 1
    where id in (
      select id from ${schema.notifications}
      where status = 'pendiente' and scheduled_at <= now()
      order by scheduled_at
      limit ${limit}
      for update skip locked
    )
    returning id
  `);
  return result.map((r) => r.id);
}

async function deliver(id: string): Promise<"enviado" | "omitido"> {
  const [row] = await db
    .select({
      notification: schema.notifications,
      booking: schema.bookings,
      professional: schema.professionals,
      client: schema.clients,
    })
    .from(schema.notifications)
    .innerJoin(schema.bookings, eq(schema.notifications.bookingId, schema.bookings.id))
    .innerJoin(schema.professionals, eq(schema.bookings.professionalId, schema.professionals.id))
    .innerJoin(schema.clients, eq(schema.bookings.clientId, schema.clients.id))
    .where(eq(schema.notifications.id, id))
    .limit(1);
  if (!row) return "omitido";

  const { notification: n, booking, professional, client } = row;
  // Un recordatorio de un turno que ya no está activo, o que ya pasó, no se manda.
  if (
    n.kind === "recordatorio" &&
    (!["reservado", "confirmado"].includes(booking.status) || booking.startsAt <= new Date())
  ) {
    return "omitido";
  }

  const tz = professional.timezone;
  const context: MessageContext = {
    professionalName: professional.displayName,
    clientName: client.name,
    serviceName: booking.serviceName,
    dateText: formatLongDate(booking.startsAt, tz),
    timeText: formatTime(booking.startsAt, tz),
    address: professional.address,
    clientPhone: client.phone,
    manageUrl: `${appUrl()}/turno/${booking.manageToken}`,
    panelUrl: `${appUrl()}/panel`,
  };
  const message = buildMessage(n.kind, context);

  if (n.channel === "email") {
    await sendEmail({ to: n.address, subject: message.subject, text: message.text, html: textToHtml(message.text) });
  } else {
    await sendWhatsapp({ to: n.address, template: message.whatsapp.template, params: message.whatsapp.params });
  }
  return "enviado";
}

/** Manda los avisos vencidos. Lo llaman las acciones después de responder y el cron de recordatorios. */
export async function processDueNotifications(limit = 50) {
  const ids = await claimDue(limit);
  const summary = { enviado: 0, omitido: 0, reintentar: 0, fallido: 0 };

  for (const id of ids) {
    try {
      const status = await deliver(id);
      await db
        .update(schema.notifications)
        .set({ status, sentAt: status === "enviado" ? new Date() : null, lastError: null })
        .where(eq(schema.notifications.id, id));
      summary[status]++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const [current] = await db
        .select({ attempts: schema.notifications.attempts })
        .from(schema.notifications)
        .where(eq(schema.notifications.id, id));
      const failed = (current?.attempts ?? MAX_ATTEMPTS) >= MAX_ATTEMPTS;
      await db
        .update(schema.notifications)
        .set({
          lastError: message.slice(0, 500),
          status: failed ? "fallido" : "pendiente",
          // Reintento con espera creciente: 5, 10, 15... minutos.
          scheduledAt: new Date(Date.now() + (current?.attempts ?? 1) * 5 * 60_000),
        })
        .where(eq(schema.notifications.id, id));
      summary[failed ? "fallido" : "reintentar"]++;
      console.error(`[avisos] falló ${id}: ${message}`);
    }
  }
  return summary;
}
