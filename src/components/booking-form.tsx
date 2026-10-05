"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { reserveAction, type BookingFormState } from "@/app/actions";

interface Props {
  professionalSlug: string;
  serviceId: string;
  startsAt: string;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-brand";

export function BookingForm({ professionalSlug, serviceId, startsAt }: Props) {
  const [state, action, pending] = useActionState<BookingFormState, FormData>(reserveAction, {});

  // Se envía a mano para que un error no borre lo que la persona escribió.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="professionalSlug" value={professionalSlug} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="startsAt" value={startsAt} />

      <Field label="Nombre y apellido" name="name" autoComplete="name" error={state.fieldErrors?.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" error={state.fieldErrors?.email} />
      <Field label="Teléfono (WhatsApp)" name="phone" type="tel" autoComplete="tel" error={state.fieldErrors?.phone} />
      <label className="block text-sm">
        Comentario (opcional)
        <textarea name="notes" rows={2} maxLength={500} className={inputClass} />
      </label>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand py-3 font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Reservando..." : "Confirmar turno"}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  ...input
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm">
      {label}
      <input required className={inputClass} aria-invalid={Boolean(error)} {...input} />
      {error && <span className="mt-1 block text-danger">{error}</span>}
    </label>
  );
}
