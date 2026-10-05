import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { inputClass } from "@/lib/form-state";
import { resetPasswordAction } from "../actions";

export const metadata: Metadata = { title: "Elegir contraseña nueva", robots: { index: false } };

export default async function ResetPage(props: PageProps<"/restablecer">) {
  const { token } = await props.searchParams;
  if (typeof token !== "string" || !token) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">Link incompleto</h1>
        <p className="text-muted">
          Abrí el link completo del email, o{" "}
          <Link href="/recuperar" className="font-medium text-brand hover:underline">
            pedí uno nuevo
          </Link>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Elegí tu contraseña nueva</h1>
      <ActionForm action={resetPasswordAction} submitLabel="Guardar contraseña">
        <input type="hidden" name="token" value={token} />
        <label className="block text-sm">
          Contraseña nueva
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </label>
        <label className="block text-sm">
          Repetila
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </label>
      </ActionForm>
      <p className="text-sm text-muted">
        ¿El link venció?{" "}
        <Link href="/recuperar" className="font-medium text-brand hover:underline">
          Pedí uno nuevo
        </Link>
      </p>
    </div>
  );
}
