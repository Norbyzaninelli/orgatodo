"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import type { FormState } from "@/lib/form-state";

interface Props {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel?: string;
  children: ReactNode;
  className?: string;
  /** Vacía el formulario después de guardar bien, para cargar otro. */
  resetOnSuccess?: boolean;
}

/**
 * Formulario que llama a una acción del servidor y muestra su resultado.
 * Se envía a mano para que un error no borre lo que la persona escribió.
 */
export function ActionForm({ action, submitLabel, pendingLabel, children, className, resetOnSuccess }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className={className ?? "space-y-3"}>
      {children}
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand">{state.ok}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? (pendingLabel ?? "Guardando...") : submitLabel}
      </button>
    </form>
  );
}
