import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { signUpAction } from "@/app/(cuenta)/actions";
import { ActionForm } from "@/components/action-form";
import { db, schema } from "@/db";
import { getSession } from "@/lib/auth";
import { findOpenInvite } from "@/lib/centros";
import { inputClass } from "@/lib/form-state";
import { joinCentroAction } from "./actions";

export const metadata: Metadata = { title: "Sumate al centro", robots: { index: false } };

export default async function JoinPage(props: PageProps<"/unirme/[token]">) {
  const { token } = await props.params;
  const found = /^[0-9a-f]{48}$/.test(token) ? await findOpenInvite(token) : null;

  if (!found) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">La invitación no está disponible</h1>
        <p className="text-muted">Venció, se canceló o ya se usó. Pedile a tu centro que te mande una nueva.</p>
      </div>
    );
  }
  const { invite, organization } = found;
  const session = await getSession();
  const pro = session
    ? await db.query.professionals.findFirst({ where: eq(schema.professionals.userId, session.user.id) })
    : null;

  return (
    <div className="mx-auto w-full max-w-sm space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-brand">Invitación</p>
        <h1 className="text-2xl font-bold tracking-tight">Sumate a {organization.name}</h1>
        <p className="text-muted">
          Vas a aparecer en la página del centro y vas a tener tu propia agenda, tus turnos y tu facturación con tu CUIT.
          El centro ve tu agenda, pero no factura ni cobra por vos.
        </p>
      </div>

      {pro ? (
        <ActionForm action={joinCentroAction} submitLabel={`Sumarme como ${pro.displayName}`} pendingLabel="Sumando...">
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-muted">
            Te llevás tus servicios, tus turnos, tus clientes y tu conexión con ARCA.
          </p>
        </ActionForm>
      ) : (
        <>
          <ActionForm action={signUpAction} submitLabel="Crear mi cuenta y sumarme" pendingLabel="Creando...">
            <input type="hidden" name="invitacion" value={token} />
            <label className="block text-sm">
              Nombre y apellido, o nombre profesional
              <input name="name" required autoComplete="name" defaultValue={invite.name ?? ""} className={inputClass} />
            </label>
            <label className="block text-sm">
              Email
              <input name="email" type="email" required autoComplete="email" defaultValue={invite.email} className={inputClass} />
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
            ¿Ya tenés cuenta en ORGATODO?{" "}
            <Link href={`/ingresar?volver=/unirme/${token}`} className="font-medium text-brand hover:underline">
              Ingresá y sumate
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
