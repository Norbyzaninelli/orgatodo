import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { submitReviewAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { getBookingByToken } from "@/lib/agenda/booking";
import { inputClass } from "@/lib/form-state";
import { getReviewForToken } from "@/lib/resenas";

export const metadata: Metadata = { title: "Dejá tu reseña", robots: { index: false } };

const LABELS = ["", "Muy malo", "Malo", "Bien", "Muy bien", "Excelente"];

export default async function ReviewPage(props: PageProps<"/turno/[token]/resena">) {
  const { token } = await props.params;
  const [row, existing] = await Promise.all([getBookingByToken(token), getReviewForToken(token)]);
  if (!row) notFound();
  if (existing?.review) redirect(`/turno/${token}`);
  const { booking, professional } = row;

  if (booking.status !== "realizado") {
    return (
      <div className="mx-auto w-full max-w-md space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">Todavía no podés dejar tu reseña</h1>
        <p className="text-muted">Vas a poder hacerlo cuando {professional.displayName} marque el turno como realizado.</p>
        <Link href={`/turno/${token}`} className="font-medium text-brand hover:underline">
          Volver a tu turno
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">¿Cómo te fue con {professional.displayName}?</h1>
        <p className="text-muted">
          {booking.serviceName}. Tu reseña se publica en su página con tu nombre de pila.
        </p>
      </div>
      <ActionForm action={submitReviewAction} submitLabel="Publicar reseña" pendingLabel="Publicando...">
        <input type="hidden" name="token" value={token} />
        <fieldset>
          <legend className="text-sm">Puntuación</legend>
          {/* En el código van de 5 a 1 y se muestran al revés: así al elegir una se pintan también las anteriores. */}
          <div className="mt-1 flex flex-row-reverse justify-end gap-1">
            {[5, 4, 3, 2, 1].map((n) => (
              <Fragment key={n}>
                <input type="radio" name="rating" value={n} id={`rating-${n}`} required className="peer sr-only" />
                <label
                  htmlFor={`rating-${n}`}
                  title={LABELS[n]}
                  className="cursor-pointer text-4xl text-zinc-300 transition peer-checked:text-amber-500 peer-focus-visible:outline dark:text-zinc-600"
                >
                  ★<span className="sr-only">{`${n} - ${LABELS[n]}`}</span>
                </label>
              </Fragment>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          Comentario (opcional)
          <textarea
            name="comment"
            rows={4}
            maxLength={1000}
            placeholder="¿Qué te gustó? ¿Qué se podría mejorar?"
            className={inputClass}
          />
        </label>
      </ActionForm>
    </div>
  );
}
