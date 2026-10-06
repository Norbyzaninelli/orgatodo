import { formatRating, type RatingSummary } from "@/lib/resenas";

/** Estrellas de 1 a 5 para mostrar una puntuación. */
export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const rounded = Math.round(value);
  return (
    <span className={`tracking-tight text-amber-500 ${className}`} aria-label={`${formatRating(value)} de 5 estrellas`}>
      {"★".repeat(rounded)}
      <span className="text-zinc-300 dark:text-zinc-600">{"★".repeat(5 - rounded)}</span>
    </span>
  );
}

/** "★ 4,8 (12 reseñas)" */
export function RatingBadge({ rating, className = "" }: { rating: RatingSummary | null; className?: string }) {
  if (!rating || rating.count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${className}`}>
      <span className="text-amber-500" aria-hidden>
        ★
      </span>
      <span className="font-semibold">{formatRating(rating.average)}</span>
      <span className="text-muted">
        ({rating.count} {rating.count === 1 ? "reseña" : "reseñas"})
      </span>
    </span>
  );
}
