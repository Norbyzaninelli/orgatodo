import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSession } from "@/lib/auth";
import { inputClass } from "@/lib/form-state";
import { signUpAction } from "../actions";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignUpPage() {
  const session = await getSession();
  if (session) {
    const pro = await db.query.professionals.findFirst({ where: eq(schema.professionals.userId, session.user.id) });
    if (pro) redirect("/panel");
  }
  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Creá tu cuenta</h1>
        <p className="text-muted">En unos minutos tenés tu página para recibir turnos.</p>
      </div>
      <ActionForm action={signUpAction} submitLabel="Crear cuenta" pendingLabel="Creando...">
        <label className="block text-sm">
          Nombre y apellido, o nombre profesional
          <input name="name" required autoComplete="name" className={inputClass} />
        </label>
        <label className="block text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </label>
        <label className="block text-sm">
          Contraseña
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        </label>
        <label className="block text-sm">
          Tu dirección
          <div className="mt-1 flex items-center rounded-lg border border-border bg-background focus-within:border-brand">
            <span className="pl-3 text-muted">orgatodo.com/</span>
            <input
              name="slug"
              required
              pattern={"[a-z0-9\\-]{3,40}"}
              placeholder="tu-nombre"
              className="w-full bg-transparent py-2 pr-3 outline-none"
            />
          </div>
        </label>
      </ActionForm>
      <p className="text-sm text-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href="/ingresar" className="font-medium text-brand hover:underline">
          Ingresá
        </Link>
      </p>
    </div>
  );
}
