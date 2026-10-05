import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Professional } from "@/db/schema";
import { BookingError, isExclusionViolation } from "./booking";
import { localToInstant } from "./slots";

export const manualBookingSchema = z.object({
  professionalId: z.uuid(),
  serviceId: z.uuid(),
  date: z.iso.date("Elegí el día"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Elegí la hora"),
  name: z.string().trim().min(2, "Ingresá el nombre del cliente").max(120),
  email: z
    .union([z.email("El email no es válido").trim().toLowerCase(), z.literal("")])
    .optional()
    .transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => v || null),
  notes: z.string().trim().max(500).optional(),
  notifyClient: z.string().optional(),
});

export type ManualBooking = z.infer<typeof manualBookingSchema>;

/**
 * Turno cargado por el profesional (o por quien administra su centro), por ejemplo uno que le
 * pidieron por WhatsApp. Puede ir fuera del horario publicado, pero nunca encima de otro turno.
 */
export async function createManualBooking(professional: Professional, input: ManualBooking) {
  const service = await db.query.services.findFirst({
    where: and(eq(schema.services.id, input.serviceId), eq(schema.services.professionalId, professional.id)),
  });
  if (!service) throw new BookingError("not_found", "Elegí un servicio de ese profesional");

  const [hours, minutes] = input.time.split(":").map(Number);
  const startsAt = localToInstant(input.date, hours * 60 + minutes, professional.timezone);
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

  try {
    return await db.transaction(async (tx) => {
      const clientId = await findOrCreateClient(tx, professional.id, input);
      const [booking] = await tx
        .insert(schema.bookings)
        .values({
          professionalId: professional.id,
          serviceId: service.id,
          clientId,
          startsAt,
          endsAt,
          status: "confirmado",
          source: "manual",
          serviceName: service.name,
          priceCents: service.priceCents,
          notes: input.notes || null,
        })
        .returning();
      return booking;
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new BookingError("slot_taken", "Ya hay un turno en ese horario. Elegí otro.");
    }
    throw error;
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Reusa el cliente por email o, si no dejó email, por teléfono; si no, lo crea. */
async function findOrCreateClient(tx: Tx, professionalId: string, input: ManualBooking): Promise<string> {
  if (input.email) {
    const [client] = await tx
      .insert(schema.clients)
      .values({ professionalId, name: input.name, email: input.email, phone: input.phone })
      .onConflictDoUpdate({
        target: [schema.clients.professionalId, schema.clients.email],
        set: { name: input.name, phone: sql`coalesce(excluded.phone, ${schema.clients.phone})`, updatedAt: sql`now()` },
      })
      .returning({ id: schema.clients.id });
    return client.id;
  }
  if (input.phone) {
    const digits = input.phone.replace(/\D/g, "");
    const [existing] = await tx
      .select({ id: schema.clients.id })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.professionalId, professionalId),
          sql`regexp_replace(coalesce(${schema.clients.phone}, ''), '\\D', '', 'g') = ${digits}`,
        ),
      )
      .limit(1);
    if (existing) return existing.id;
  }
  const [client] = await tx
    .insert(schema.clients)
    .values({ professionalId, name: input.name, email: null, phone: input.phone })
    .returning({ id: schema.clients.id });
  return client.id;
}
