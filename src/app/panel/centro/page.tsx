import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { ListingFields } from "@/components/listing-fields";
import { db, schema } from "@/db";
import { requireProfessional } from "@/lib/auth";
import { getOrganization, inviteUrl, listMembers } from "@/lib/centros";
import { inputClass } from "@/lib/form-state";
import { formatLongDate } from "@/lib/format";
import {
  convertToCentroAction,
  inviteAction,
  leaveCentroAction,
  removeMemberAction,
  revokeInviteAction,
  saveCentroAction,
  setAdminAction,
  setCentroPublishedAction,
} from "./actions";

export const metadata: Metadata = { title: "Centro" };

const sectionTitle = "text-sm font-semibold uppercase tracking-wide text-muted";
const smallButton = "rounded-lg border border-border px-2.5 py-1 text-sm font-medium transition hover:border-brand";

export default async function CentroPage(props: PageProps<"/panel/centro">) {
  const pro = await requireProfessional();
  const org = await getOrganization(pro.organizationId);
  const { error } = await props.searchParams;

  if (org.kind !== "centro") return <CreateCentro defaultName={pro.displayName} />;

  const [members, invites] = await Promise.all([
    listMembers(org.id),
    pro.isAdmin
      ? db
          .select()
          .from(schema.organizationInvites)
          .where(
            and(
              eq(schema.organizationInvites.organizationId, org.id),
              isNull(schema.organizationInvites.acceptedAt),
              gt(schema.organizationInvites.expiresAt, new Date()),
            ),
          )
          .orderBy(asc(schema.organizationInvites.createdAt))
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
          <p className="text-sm text-muted">
            orgatodo.com/{org.slug} · {org.published ? "publicado" : "sin publicar"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {org.published && (
            <Link href={`/${org.slug}`} className={smallButton}>
              Ver página del centro
            </Link>
          )}
          {pro.isAdmin && (
            <Link href="/panel/centro/agenda" className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-strong">
              Agenda del equipo
            </Link>
          )}
        </div>
      </div>

      {typeof error === "string" && (
        <p className="rounded-lg border border-danger p-3 text-sm text-danger">{error}</p>
      )}

      <div className="space-y-8 xl:grid xl:grid-cols-2 xl:gap-8 xl:space-y-0">
        <section className="space-y-3">
          <h2 className={sectionTitle}>Equipo</h2>
          <ul className="space-y-2">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {member.displayName}
                    {member.id === pro.id && <span className="font-normal text-muted"> (vos)</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {member.isAdmin ? "Administra" : "Profesional"}
                    {" · "}
                    {member.published ? (
                      <Link href={`/${member.slug}`} className="text-brand hover:underline">
                        orgatodo.com/{member.slug}
                      </Link>
                    ) : (
                      "página sin publicar"
                    )}
                  </p>
                </div>
                {pro.isAdmin && member.id !== pro.id && (
                  <div className="flex flex-wrap gap-2">
                    <form action={setAdminAction}>
                      <input type="hidden" name="professionalId" value={member.id} />
                      <input type="hidden" name="isAdmin" value={String(!member.isAdmin)} />
                      <button type="submit" className={smallButton}>
                        {member.isAdmin ? "Quitar administración" : "Darle administración"}
                      </button>
                    </form>
                    <form action={removeMemberAction}>
                      <input type="hidden" name="professionalId" value={member.id} />
                      <button type="submit" className={`${smallButton} text-danger`}>
                        Sacar del centro
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            Cada profesional maneja su agenda, sus servicios y factura con su propio CUIT. El centro no factura por nadie.
          </p>
        </section>

        {pro.isAdmin && (
          <section className="space-y-3">
            <h2 className={sectionTitle}>Invitar profesionales</h2>
            <ActionForm action={inviteAction} submitLabel="Mandar invitación" pendingLabel="Mandando..." resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  Email
                  <input name="email" type="email" required className={inputClass} />
                </label>
                <label className="block text-sm">
                  Nombre (opcional)
                  <input name="name" maxLength={120} className={inputClass} />
                </label>
              </div>
            </ActionForm>
            {invites.length > 0 && (
              <ul className="space-y-2">
                {invites.map((invite) => {
                  const url = inviteUrl(invite.token);
                  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
                    `Te invito a sumarte a ${org.name} en ORGATODO: ${url}`,
                  )}`;
                  return (
                    <li key={invite.id} className="space-y-2 rounded-xl border border-dashed border-border p-3">
                      <div>
                        <p className="font-medium">{invite.name ? `${invite.name} · ${invite.email}` : invite.email}</p>
                        <p className="text-sm text-muted">
                          Invitación pendiente, vence el {formatLongDate(invite.expiresAt, pro.timezone)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <CopyButton text={url} />
                        <a href={whatsapp} target="_blank" rel="noreferrer" className={smallButton}>
                          Mandar por WhatsApp
                        </a>
                        <form action={revokeInviteAction}>
                          <input type="hidden" name="inviteId" value={invite.id} />
                          <button type="submit" className={`${smallButton} text-muted`}>
                            Cancelar
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {pro.isAdmin && (
        <div className="space-y-8 xl:grid xl:grid-cols-2 xl:gap-8 xl:space-y-0">
          <section className="space-y-3">
            <h2 className={sectionTitle}>Página del centro</h2>
            <ActionForm action={saveCentroAction} submitLabel="Guardar datos del centro">
              <label className="block text-sm">
                Nombre del centro
                <input name="name" required maxLength={120} defaultValue={org.name} className={inputClass} />
              </label>
              <SlugInput defaultValue={org.slug} />
              <label className="block text-sm">
                Presentación
                <textarea
                  name="description"
                  rows={3}
                  maxLength={600}
                  defaultValue={org.description ?? ""}
                  placeholder="Qué servicios ofrece el centro y cómo se trabaja"
                  className={inputClass}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  Dirección
                  <input name="address" maxLength={200} defaultValue={org.address ?? ""} className={inputClass} />
                </label>
                <label className="block text-sm">
                  Teléfono o WhatsApp
                  <input name="phone" type="tel" maxLength={30} defaultValue={org.phone ?? ""} className={inputClass} />
                </label>
              </div>
              <ListingFields category={org.category} city={org.city} province={org.province} />
            </ActionForm>
          </section>

          <section className="space-y-2 self-start rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">Publicar el centro</h2>
            <p className="text-sm text-muted">
              La página del centro muestra a cada profesional que tenga su página publicada, con sus servicios, para
              que el cliente elija con quién reservar.
            </p>
            <form action={setCentroPublishedAction}>
              <input type="hidden" name="published" value={String(!org.published)} />
              <button type="submit" className={org.published ? smallButton : "rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-strong"}>
                {org.published ? "Despublicar" : "Publicar la página del centro"}
              </button>
            </form>
          </section>
        </div>
      )}

      <section className="space-y-2 border-t border-border pt-6">
        <h2 className="font-semibold">Salir del centro</h2>
        <p className="text-sm text-muted">
          Seguís con tu cuenta, tu página, tus turnos y tu facturación como independiente.
        </p>
        <form action={leaveCentroAction}>
          <button type="submit" className={`${smallButton} text-danger`}>
            Salir de {org.name}
          </button>
        </form>
      </section>
    </div>
  );
}

function SlugInput({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="block text-sm">
      Dirección del centro
      <div className="mt-1 flex items-center rounded-lg border border-border bg-background focus-within:border-brand">
        <span className="pl-3 text-muted">orgatodo.com/</span>
        <input
          name="slug"
          required
          pattern={"[a-z0-9\\-]{3,40}"}
          defaultValue={defaultValue}
          placeholder="nombre-del-centro"
          className="w-full bg-transparent py-2 pr-3 outline-none"
        />
      </div>
    </label>
  );
}

function CreateCentro({ defaultName }: { defaultName: string }) {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Armá tu centro</h1>
        <p className="text-muted">
          Si trabajás con otros profesionales, sumalos a un centro. El centro tiene su propia página donde el cliente
          elige profesional y servicio, y vos ves la agenda de todo el equipo.
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted">
          <li>Cada profesional tiene su cuenta, su agenda y factura con su propio CUIT.</li>
          <li>Vos seguís teniendo tu página y tus turnos como hasta ahora.</li>
          <li>Invitás a cada profesional con un link por email o WhatsApp.</li>
        </ul>
      </section>
      <section className="max-w-lg space-y-3 rounded-xl border border-border bg-surface p-4">
        <ActionForm action={convertToCentroAction} submitLabel="Crear el centro" pendingLabel="Creando...">
          <label className="block text-sm">
            Nombre del centro
            <input name="name" required maxLength={120} placeholder={`Centro ${defaultName}`} className={inputClass} />
          </label>
          <SlugInput />
        </ActionForm>
      </section>
    </div>
  );
}
