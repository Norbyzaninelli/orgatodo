import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import type { Professional, Service } from "@/db/schema";
import { BookingError } from "./agenda/booking";
import { createManualBooking } from "./agenda/manual";
import { addDays, toLocalDate } from "./agenda/slots";
import { manageableProfessionals } from "./equipo";
import { enqueueBookingEvent } from "./notifications/queue";
import { ReviewError, combineRatings, publicName, ratingsFor, submitReview } from "./resenas";

describe("reseñas sin base de datos", () => {
  it("muestra solo el nombre de pila", () => {
    expect(publicName("  María José Pérez ")).toBe("María");
    expect(publicName("")).toBe("Cliente");
  });

  it("combina promedios ponderando por cantidad", () => {
    expect(combineRatings([{ average: 5, count: 3 }, { average: 3, count: 1 }, undefined])).toEqual({ average: 4.5, count: 4 });
    expect(combineRatings([undefined])).toBeNull();
  });
});

// Usa la base de datos de desarrollo o la de CI; crea y borra sus propios datos.
describe.skipIf(!process.env.DATABASE_URL)("turnos a mano y reseñas", () => {
  const run = randomBytes(3).toString("hex");
  const orgIds: string[] = [];
  let admin: Professional;
  let member: Professional;
  let solo: Professional;
  let service: Service;
  const tz = "America/Argentina/Buenos_Aires";
  const day = addDays(toLocalDate(new Date(), tz), 3);

  async function pro(organizationId: string, name: string, isAdmin: boolean) {
    const [row] = await db
      .insert(schema.professionals)
      .values({ organizationId, slug: `t-${run}-${name}`, displayName: name, email: `${name}-${run}@test.local`, isAdmin, phone: "+54 9 11 5000-0000" })
      .returning();
    return row;
  }

  beforeAll(async () => {
    const [centro] = await db.insert(schema.organizations).values({ slug: `t-${run}-centro`, name: "Centro", kind: "centro" }).returning();
    const [indep] = await db.insert(schema.organizations).values({ slug: `t-${run}-solo`, name: "Solo" }).returning();
    orgIds.push(centro.id, indep.id);
    admin = await pro(centro.id, "admin", true);
    member = await pro(centro.id, "miembro", false);
    solo = await pro(indep.id, "solo", true);
    [service] = await db
      .insert(schema.services)
      .values({ professionalId: member.id, name: "Masaje", durationMinutes: 60, priceCents: 2000000 })
      .returning();
  });

  afterAll(async () => {
    const pros = await db
      .select({ id: schema.professionals.id })
      .from(schema.professionals)
      .where(inArray(schema.professionals.organizationId, orgIds));
    const ids = pros.map((p) => p.id);
    await db.delete(schema.bookings).where(inArray(schema.bookings.professionalId, ids));
    await db.delete(schema.organizations).where(inArray(schema.organizations.id, orgIds));
  });

  it("solo quien administra un centro maneja los turnos del equipo", async () => {
    expect((await manageableProfessionals(admin)).map((p) => p.id).sort()).toEqual([admin.id, member.id].sort());
    expect((await manageableProfessionals(member)).map((p) => p.id)).toEqual([member.id]);
    expect((await manageableProfessionals(solo)).map((p) => p.id)).toEqual([solo.id]);
  });

  it("carga un turno sin email y no deja superponer otro", async () => {
    const base = { professionalId: member.id, serviceId: service.id, date: day, notes: undefined, notifyClient: "on" };
    const booking = await createManualBooking(member, { ...base, time: "10:00", name: "Lucía Gómez", email: null, phone: "11 4444-5555" });
    expect(booking).toMatchObject({ status: "confirmado", source: "manual", priceCents: 2000000 });

    await expect(
      createManualBooking(member, { ...base, time: "10:30", name: "Otro", email: null, phone: null }),
    ).rejects.toThrow(BookingError);

    // El mismo teléfono escrito distinto es el mismo cliente.
    const again = await createManualBooking(member, { ...base, time: "12:00", name: "Lucía", email: null, phone: "11 4444 5555" });
    expect(again.clientId).toBe(booking.clientId);

    // Un servicio de otra persona no se puede usar.
    await expect(
      createManualBooking(solo, { ...base, professionalId: solo.id, time: "15:00", name: "X", email: null, phone: null }),
    ).rejects.toThrow(/servicio/);

    // Sin email, la confirmación sale solo por WhatsApp.
    await enqueueBookingEvent(booking.id, "cargado", { notifyClient: true, notifyProfessional: false });
    const sent = await db.select().from(schema.notifications).where(eq(schema.notifications.bookingId, booking.id));
    expect(sent.map((n) => `${n.kind}:${n.channel}`).sort()).toEqual(["recordatorio:whatsapp", "turno_confirmado:whatsapp"]);
  });

  it("pide la reseña al terminar y acepta una sola", async () => {
    const booking = await createManualBooking(member, {
      professionalId: member.id,
      serviceId: service.id,
      date: day,
      time: "16:00",
      name: "Diego Castro",
      email: `diego-${run}@test.local`,
      phone: null,
      notes: undefined,
      notifyClient: undefined,
    });
    await expect(submitReview({ token: booking.manageToken, rating: 5, comment: null })).rejects.toThrow(ReviewError);

    await db.update(schema.bookings).set({ status: "realizado" }).where(eq(schema.bookings.id, booking.id));
    await enqueueBookingEvent(booking.id, "realizado");
    const isPending = async () =>
      db
        .select({ status: schema.notifications.status })
        .from(schema.notifications)
        .where(and(eq(schema.notifications.bookingId, booking.id), eq(schema.notifications.kind, "pedido_resena")));
    expect(await isPending()).toEqual([{ status: "pendiente" }]);

    const review = await submitReview({ token: booking.manageToken, rating: 4, comment: "Muy bien" });
    expect(review).toMatchObject({ rating: 4, authorName: "Diego", professionalId: member.id });
    // El pedido que no había salido se cancela.
    expect(await isPending()).toEqual([{ status: "omitido" }]);
    await expect(submitReview({ token: booking.manageToken, rating: 1, comment: null })).rejects.toThrow(/Ya dejaste/);

    expect((await ratingsFor([member.id])).get(member.id)).toEqual({ average: 4, count: 1 });
  });
});
