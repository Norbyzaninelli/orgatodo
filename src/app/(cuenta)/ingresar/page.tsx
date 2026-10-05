import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { getSession } from "@/lib/auth";
import { inputClass } from "@/lib/form-state";
import { signInAction } from "../actions";

export const metadata: Metadata = { title: "Ingresar" };

export default async function SignInPage(props: PageProps<"/ingresar">) {
  if (await getSession()) redirect("/panel");
  const { volver } = await props.searchParams;
  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Ingresá a tu panel</h1>
      <ActionForm action={signInAction} submitLabel="Ingresar" pendingLabel="Ingresando...">
        {typeof volver === "string" && <input type="hidden" name="volver" value={volver} />}
        <label className="block text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
        <label className="block text-sm">
          Contraseña
          <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
        </label>
      </ActionForm>
      <p className="text-sm text-muted">
        ¿Todavía no tenés cuenta?{" "}
        <Link href="/registro" className="font-medium text-brand hover:underline">
          Creá una
        </Link>
      </p>
    </div>
  );
}
