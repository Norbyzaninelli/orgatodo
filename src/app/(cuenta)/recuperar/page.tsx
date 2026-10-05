import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { inputClass } from "@/lib/form-state";
import { requestPasswordResetAction } from "../actions";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RequestResetPage() {
  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">¿Olvidaste tu contraseña?</h1>
        <p className="text-muted">Te mandamos un link por email para que elijas una nueva.</p>
      </div>
      <ActionForm action={requestPasswordResetAction} submitLabel="Mandarme el link" pendingLabel="Mandando...">
        <label className="block text-sm">
          Email de tu cuenta
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
      </ActionForm>
      <p className="text-sm text-muted">
        <Link href="/ingresar" className="font-medium text-brand hover:underline">
          Volver a ingresar
        </Link>
      </p>
    </div>
  );
}
