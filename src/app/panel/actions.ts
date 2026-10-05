"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireProfessional } from "@/lib/auth";
import { notifyBookingEvent } from "@/lib/notifications";
import type { FormState } from "@/lib/form-state";
import { parsePriceToCents, timeToMinutes } from "@/lib/time";

function revalidatePublic(slug: string) {
  revalidatePath(`/${slug}`, "layout");
}

// --- Turnos ---------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  confirmado: ["reservado"],
  realizado: ["reservado", "confirmado", "ausente"],
  ausente: ["reservado", "confirmado", "realizado"],
  cancelado: ["reservado", "confirmado"],
};

export async function setBookingStatusAction(formData: FormData) {
  const pro = await requireProfessional();
  const id = z.uuid().parse(formData.get("bookingId"));
  const status = z.enum(["confirmado", "realizado", "ausente", "cancelado"]).parse(formData.get("status"));

  const updated = await db
    .update(schema.bookings)
    .set({ status, cancelledAt: status === "cancelado" ? new Date() : null })
    .where(
      and(
        eq(schema.bookings.id, id),
        eq(schema.bookings.professionalId, pro.id),
        inArray(schema.bookings.status, ALLOWED_TRANSITIONS[status] as ("reservado" | "confirmado" | "realizado" | "ausente")[]),
      ),
    )
    .returning({ id: schema.bookings.id });

  if (updated.length > 0 && status === "confirmado") await notifyBookingEvent(id, "confirmado");
  if (updated.length > 0 && status === "cancelado") await notifyBookingEvent(id, "cancelado_por_profesional");
  revalidatePath("/panel");
  revalidatePublic(pro.slug);
}

// --- Servicios ------------------------------------------------------------

const serviceSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Ingresá el nombre del servicio").max(120),
  description: z.string().trim().max(500).optional(),
  durationMinutes: z.coerce.number().int().min(5, "La duración mínima es 5 minutos").max(720),
  price: z.string(),
  modality: z.enum(["presencial", "virtual"]),
});

export async function saveServiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pro = await requireProfessional();
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const priceCents = parsePriceToCents(parsed.data.price);
  if (priceCents === null) return { error: "Ingresá el precio en pesos, por ejemplo 25000" };

  const values = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    durationMinutes: parsed.data.durationMinutes,
    priceCents,
    modality: parsed.data.modality,
  };

  if (parsed.data.id) {
    const updated = await db
      .update(schema.services)
      .set(values)
      .where(and(eq(schema.services.id, parsed.data.id), eq(schema.services.professionalId, pro.id)))
      .returning({ id: schema.services.id });
    if (updated.length === 0) return { error: "No encontramos ese servicio" };
  } else {
    await db.insert(schema.services).values({ ...values, professionalId: pro.id });
  }

  revalidatePath("/panel/servicios");
  revalidatePublic(pro.slug);
  return { ok: parsed.data.id ? "Cambios guardados" : "Servicio agregado" };
}

export async function toggleServiceAction(formData: FormData) {
  const pro = await requireProfessional();
  const id = z.uuid().parse(formData.get("serviceId"));
  const active = formData.get("active") === "true";
  await db
    .update(schema.services)
    .set({ active })
    .where(and(eq(schema.services.id, id), eq(schema.services.professionalId, pro.id)));
  revalidatePath("/panel/servicios");
  revalidatePublic(pro.slug);
}

// --- Horarios -------------------------------------------------------------

const blockSchema = z.object({ weekday: z.number().int().min(0).max(6), start: z.string(), end: z.string() });

export async function saveScheduleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pro = await requireProfessional();
  let blocks: z.infer<typeof blockSchema>[];
  try {
    blocks = z.array(blockSchema).max(70).parse(JSON.parse(String(formData.get("blocks") ?? "[]")));
  } catch {
    return { error: "No pudimos leer los horarios" };
  }

  const rules: { weekday: number; startMinute: number; endMinute: number }[] = [];
  for (const block of blocks) {
    const startMinute = timeToMinutes(block.start);
    const endMinute = timeToMinutes(block.end);
    if (startMinute === null || endMinute === null) return { error: "Revisá que todas las horas estén completas" };
    if (endMinute <= startMinute) return { error: `En cada bloque, la hora de fin tiene que ser posterior al inicio (${block.start} a ${block.end})` };
    rules.push({ weekday: block.weekday, startMinute, endMinute });
  }

  // Bloques del mismo día que se pisan suelen ser un error de carga.
  for (const day of new Set(rules.map((r) => r.weekday))) {
    const sorted = rules.filter((r) => r.weekday === day).sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startMinute < sorted[i - 1].endMinute) return { error: "Hay bloques que se superponen en el mismo día" };
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.availabilityRules).where(eq(schema.availabilityRules.professionalId, pro.id));
    if (rules.length > 0) {
      await tx.insert(schema.availabilityRules).values(rules.map((r) => ({ ...r, professionalId: pro.id })));
    }
  });

  revalidatePath("/panel/horarios");
  revalidatePublic(pro.slug);
  return { ok: "Horarios guardados" };
}

const exceptionSchema = z.object({
  date: z.iso.date("Elegí una fecha"),
  allDay: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  reason: z.string().trim().max(120).optional(),
});

export async function addExceptionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pro = await requireProfessional();
  const parsed = exceptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let startMinute: number | null = null;
  let endMinute: number | null = null;
  if (!parsed.data.allDay) {
    startMinute = timeToMinutes(parsed.data.start ?? "");
    endMinute = timeToMinutes(parsed.data.end ?? "");
    if (startMinute === null || endMinute === null) return { error: "Completá desde y hasta, o marcá el día entero" };
    if (endMinute <= startMinute) return { error: "La hora de fin tiene que ser posterior al inicio" };
  }

  await db.insert(schema.availabilityExceptions).values({
    professionalId: pro.id,
    date: parsed.data.date,
    startMinute,
    endMinute,
    reason: parsed.data.reason || null,
  });
  revalidatePath("/panel/horarios");
  revalidatePublic(pro.slug);
  return { ok: "Bloqueo agregado" };
}

export async function deleteExceptionAction(formData: FormData) {
  const pro = await requireProfessional();
  const id = z.uuid().parse(formData.get("exceptionId"));
  await db
    .delete(schema.availabilityExceptions)
    .where(and(eq(schema.availabilityExceptions.id, id), eq(schema.availabilityExceptions.professionalId, pro.id)));
  revalidatePath("/panel/horarios");
  revalidatePublic(pro.slug);
}

// --- Perfil ---------------------------------------------------------------

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Ingresá tu nombre").max(120),
  bio: z.string().trim().max(600).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(200).optional(),
  minNoticeMinutes: z.coerce.number().int().min(0).max(60 * 24 * 14),
  bufferMinutes: z.coerce.number().int().min(0).max(240),
  slotStepMinutes: z.coerce.number().int().refine((n) => [10, 15, 20, 30, 45, 60].includes(n)),
  maxDaysAhead: z.coerce.number().int().min(1).max(365),
  autoConfirm: z.string().optional(),
  worksOnHolidays: z.string().optional(),
  notifyByWhatsapp: z.string().optional(),
  notifyByEmail: z.string().optional(),
  reminderHoursBefore: z.coerce.number().int().refine((n) => [0, 2, 12, 24, 48].includes(n)),
});

export async function saveProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pro = await requireProfessional();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await db
    .update(schema.professionals)
    .set({
      displayName: d.displayName,
      bio: d.bio || null,
      phone: d.phone || null,
      address: d.address || null,
      minNoticeMinutes: d.minNoticeMinutes,
      bufferMinutes: d.bufferMinutes,
      slotStepMinutes: d.slotStepMinutes,
      maxDaysAhead: d.maxDaysAhead,
      autoConfirm: d.autoConfirm === "on",
      worksOnHolidays: d.worksOnHolidays === "on",
      notifyByWhatsapp: d.notifyByWhatsapp === "on",
      notifyByEmail: d.notifyByEmail === "on",
      reminderHoursBefore: d.reminderHoursBefore,
    })
    .where(eq(schema.professionals.id, pro.id));
  revalidatePath("/panel", "layout");
  revalidatePublic(pro.slug);
  return { ok: "Perfil guardado" };
}

export async function setPublishedAction(formData: FormData) {
  const pro = await requireProfessional();
  await db
    .update(schema.professionals)
    .set({ published: formData.get("published") === "true" })
    .where(eq(schema.professionals.id, pro.id));
  revalidatePath("/panel", "layout");
  revalidatePublic(pro.slug);
}
