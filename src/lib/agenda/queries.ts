import { and, asc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Professional, Service } from "@/db/schema";
import { addDays, availableSlots, localToInstant, toLocalDate, type DaySlots, type SlotInput } from "./slots";

const ACTIVE_STATUSES = ["reservado", "confirmado", "realizado"] as const;

export async function getPublishedProfessional(slug: string) {
  const professional = await db.query.professionals.findFirst({
    where: and(eq(schema.professionals.slug, slug), eq(schema.professionals.published, true)),
  });
  if (!professional) return null;
  const services = await db
    .select()
    .from(schema.services)
    .where(and(eq(schema.services.professionalId, professional.id), eq(schema.services.active, true)))
    .orderBy(asc(schema.services.position), asc(schema.services.name));
  return { professional, services };
}

/** Días que el cliente puede elegir, desde hoy hasta el límite del profesional. */
export function bookableRange(professional: Professional, now = new Date(), maxShown = 21) {
  const from = toLocalDate(now, professional.timezone);
  const to = addDays(from, Math.min(professional.maxDaysAhead, maxShown) - 1);
  return { from, to };
}

/** Arma los datos que necesita el cálculo de horarios para un rango de fechas locales. */
export async function loadSlotInput(
  professional: Professional,
  service: Service,
  from: string,
  to: string,
  now = new Date(),
): Promise<SlotInput> {
  const tz = professional.timezone;
  // Un día de margen a cada lado cubre turnos que cruzan la medianoche.
  const rangeStart = localToInstant(addDays(from, -1), 0, tz);
  const rangeEnd = localToInstant(addDays(to, 2), 0, tz);

  const [rules, blocks, holidays, busy] = await Promise.all([
    db
      .select()
      .from(schema.availabilityRules)
      .where(eq(schema.availabilityRules.professionalId, professional.id)),
    db
      .select()
      .from(schema.availabilityExceptions)
      .where(
        and(
          eq(schema.availabilityExceptions.professionalId, professional.id),
          gte(schema.availabilityExceptions.date, from),
          lte(schema.availabilityExceptions.date, to),
        ),
      ),
    db
      .select()
      .from(schema.holidays)
      .where(and(gte(schema.holidays.date, from), lte(schema.holidays.date, to))),
    db
      .select({ start: schema.bookings.startsAt, end: schema.bookings.endsAt })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.professionalId, professional.id),
          inArray(schema.bookings.status, [...ACTIVE_STATUSES]),
          lt(schema.bookings.startsAt, rangeEnd),
          gte(schema.bookings.endsAt, rangeStart),
        ),
      ),
  ]);

  return {
    timezone: tz,
    from,
    to,
    rules,
    blocks,
    holidays: holidays.map((h) => h.date),
    worksOnHolidays: professional.worksOnHolidays,
    busy,
    durationMinutes: service.durationMinutes,
    bufferMinutes: professional.bufferMinutes,
    minNoticeMinutes: professional.minNoticeMinutes,
    stepMinutes: professional.slotStepMinutes,
    now,
  };
}

export async function getSlots(
  professional: Professional,
  service: Service,
  from: string,
  to: string,
): Promise<DaySlots[]> {
  return availableSlots(await loadSlotInput(professional, service, from, to));
}
