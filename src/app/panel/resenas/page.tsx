import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { RatingBadge, Stars } from "@/components/stars";
import { requireProfessional } from "@/lib/auth";
import { inputClass } from "@/lib/form-state";
import { capitalize, formatLongDate } from "@/lib/format";
import { latestReviews, ratingsFor } from "@/lib/resenas";
import { replyReviewAction } from "../actions";

export const metadata: Metadata = { title: "Reseñas" };

export default async function ReviewsPage() {
  const pro = await requireProfessional();
  const [reviews, ratings] = await Promise.all([latestReviews(pro.id, 100), ratingsFor([pro.id])]);
  const rating = ratings.get(pro.id) ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Reseñas</h1>
        {rating ? (
          <RatingBadge rating={rating} className="text-base" />
        ) : (
          <p className="text-muted">Todavía no tenés reseñas.</p>
        )}
        <p className="text-sm text-muted">
          Cuando marcás un turno como realizado, tu cliente recibe un link para puntuarte. Las reseñas se ven en{" "}
          <Link href={`/${pro.slug}`} className="text-brand hover:underline">
            tu página
          </Link>{" "}
          y en el buscador, y podés responder cada una.
        </p>
      </div>

      <ul className="grid gap-4 xl:grid-cols-2">
        {reviews.map((review) => (
          <li key={review.id} className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={review.rating} />
                <span className="font-medium">{review.authorName}</span>
                <span className="text-sm text-muted">{capitalize(formatLongDate(review.createdAt, pro.timezone))}</span>
              </div>
              {review.comment ? <p>{review.comment}</p> : <p className="text-sm text-muted">Sin comentario.</p>}
            </div>
            <ActionForm action={replyReviewAction} submitLabel={review.reply ? "Guardar respuesta" : "Responder"}>
              <input type="hidden" name="reviewId" value={review.id} />
              <label className="block text-sm">
                Tu respuesta pública
                <textarea name="reply" rows={2} maxLength={1000} defaultValue={review.reply ?? ""} className={inputClass} />
              </label>
            </ActionForm>
          </li>
        ))}
      </ul>
    </div>
  );
}
