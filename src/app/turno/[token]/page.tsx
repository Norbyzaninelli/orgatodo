import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelAction } from "@/app/actions";
import { getBookingByToken } from "@/lib/agenda/booking";
import { Stars } from "@/components/stars";
import { formatLongDate, formatPrice, formatTime } from "@/lib/format";
import { getReviewForToken } from "@/lib/resenas";

export const metadata: Metadata = { title: "Tu turno", robots: { index: false } };

const STATUS_LABEL = {
  reservado: "Reservado, pendiente de confirmación",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
  ausente: "Ausente",
} as const;

export default async function BookingPage(props: PageProps<"/turno/[token]">) {
  const { token } = await props.params;
  const [row, reviewRow] = await Promise.all([getBookingByToken(token), getReviewForToken(token)]);
  if (!row) notFound();
  const review = reviewRow?.review ?? null;
  const { booking, professional } = row;
  const tz = professional.timezone;
  const canCancel =
    (booking.status === "reservado" || booking.status === "confirmado") && booking.startsAt > new Date();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          {STATUS_LABEL[booking.status]}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {booking.serviceName} con {professional.displayName}
        </h1>
      </div>

      <dl className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Día</dt>
          <dd className="font-semibold capitalize">{formatLongDate(booking.startsAt, tz)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Horario</dt>
          <dd className="font-semibold">
            {formatTime(booking.startsAt, tz)} a {formatTime(booking.endsAt, tz)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Precio</dt>
          <dd className="font-semibold">{formatPrice(booking.priceCents)}</dd>
        </div>
        {professional.address && (
          <div>
            <dt className="text-sm text-muted">Dirección</dt>
            <dd className="font-semibold">{professional.address}</dd>
          </div>
        )}
      </dl>

      {booking.status === "realizado" &&
        (review ? (
          <section className="space-y-1 rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">Tu reseña</p>
            <Stars value={review.rating} className="text-lg" />
            {review.comment && <p className="text-sm">{review.comment}</p>}
            <p className="text-sm text-muted">¡Gracias por contarnos cómo te fue!</p>
          </section>
        ) : (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand bg-surface p-4">
            <p className="font-medium">¿Cómo te fue? Tu reseña ayuda a otras personas a elegir.</p>
            <Link
              href={`/turno/${token}/resena`}
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand-strong"
            >
              Dejar reseña
            </Link>
          </section>
        ))}

      <p className="text-sm text-muted">Guardá este link: desde acá podés ver o cancelar tu turno.</p>

      <div className="flex flex-wrap gap-3">
        {canCancel && (
          <form action={cancelAction}>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="rounded-lg border border-danger px-4 py-2 font-medium text-danger transition hover:bg-danger hover:text-white"
            >
              Cancelar turno
            </button>
          </form>
        )}
        <Link
          href={`/${professional.slug}`}
          className="rounded-lg border border-border px-4 py-2 font-medium transition hover:border-brand"
        >
          Reservar otro turno
        </Link>
      </div>
    </div>
  );
}
