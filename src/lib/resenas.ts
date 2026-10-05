import { and, avg, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Professional } from "@/db/schema";

export const reviewSchema = z.object({
  token: z.string().min(1),
  rating: z.coerce.number().int().min(1, "Elegí de 1 a 5 estrellas").max(5, "Elegí de 1 a 5 estrellas"),
  comment: z
    .string()
    .trim()
    .max(1000, "El comentario puede tener hasta 1000 caracteres")
    .optional()
    .transform((v) => v || null),
});

export class ReviewError extends Error {}

/** Solo el nombre de pila: la reseña es pública. */
export function publicName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "Cliente";
}

/** Reseña de un turno a partir del link privado del cliente. */
export async function getReviewForToken(token: string) {
  const [row] = await db
    .select({ booking: schema.bookings, review: schema.reviews })
    .from(schema.bookings)
    .leftJoin(schema.reviews, eq(schema.reviews.bookingId, schema.bookings.id))
    .where(eq(schema.bookings.manageToken, token));
  return row ?? null;
}

/** El cliente deja su reseña desde el link de su turno. Solo turnos realizados y una vez. */
export async function submitReview(input: z.infer<typeof reviewSchema>) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ booking: schema.bookings, client: schema.clients })
      .from(schema.bookings)
      .innerJoin(schema.clients, eq(schema.bookings.clientId, schema.clients.id))
      .where(eq(schema.bookings.manageToken, input.token))
      .for("update", { of: schema.bookings });
    if (!row) throw new ReviewError("No encontramos el turno");
    if (row.booking.status !== "realizado") throw new ReviewError("Podés dejar tu reseña cuando el turno figure como realizado");

    const [review] = await tx
      .insert(schema.reviews)
      .values({
        bookingId: row.booking.id,
        professionalId: row.booking.professionalId,
        rating: input.rating,
        comment: input.comment,
        authorName: publicName(row.client.name),
      })
      .onConflictDoNothing({ target: schema.reviews.bookingId })
      .returning();
    if (!review) throw new ReviewError("Ya dejaste tu reseña para este turno. ¡Gracias!");

    // Si todavía no había salido el pedido de reseña, ya no hace falta.
    await tx
      .update(schema.notifications)
      .set({ status: "omitido" })
      .where(
        and(
          eq(schema.notifications.bookingId, row.booking.id),
          eq(schema.notifications.kind, "pedido_resena"),
          eq(schema.notifications.status, "pendiente"),
        ),
      );
    return review;
  });
}

export interface RatingSummary {
  average: number;
  count: number;
}

/** Promedio y cantidad de reseñas por profesional. */
export async function ratingsFor(professionalIds: string[]): Promise<Map<string, RatingSummary>> {
  if (professionalIds.length === 0) return new Map();
  const rows = await db
    .select({ professionalId: schema.reviews.professionalId, average: avg(schema.reviews.rating), count: count() })
    .from(schema.reviews)
    .where(inArray(schema.reviews.professionalId, professionalIds))
    .groupBy(schema.reviews.professionalId);
  return new Map(rows.map((r) => [r.professionalId, { average: Number(r.average), count: r.count }]));
}

/** Junta los resúmenes de varios profesionales, por ejemplo los de un centro. */
export function combineRatings(summaries: (RatingSummary | undefined)[]): RatingSummary | null {
  const present = summaries.filter((s): s is RatingSummary => Boolean(s && s.count > 0));
  const total = present.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;
  return { average: present.reduce((sum, s) => sum + s.average * s.count, 0) / total, count: total };
}

export function formatRating(average: number): string {
  return average.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export async function latestReviews(professionalId: string, limit = 10) {
  return db
    .select()
    .from(schema.reviews)
    .where(eq(schema.reviews.professionalId, professionalId))
    .orderBy(desc(schema.reviews.createdAt))
    .limit(limit);
}

export async function replyToReview(pro: Professional, reviewId: string, reply: string | null) {
  const updated = await db
    .update(schema.reviews)
    .set({ reply, repliedAt: reply ? new Date() : null })
    .where(and(eq(schema.reviews.id, reviewId), eq(schema.reviews.professionalId, pro.id)))
    .returning({ id: schema.reviews.id });
  if (updated.length === 0) throw new ReviewError("No encontramos esa reseña");
}
