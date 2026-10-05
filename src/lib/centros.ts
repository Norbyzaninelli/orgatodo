import { and, asc, count, eq, gt, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Organization, Professional } from "@/db/schema";
import { appUrl } from "@/lib/notifications/process";

/** Días que dura el link de una invitación. */
export const INVITE_DAYS = 14;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class CentroError extends Error {}

/** Una dirección pública es única entre profesionales y centros. */
export async function isSlugTaken(slug: string, exceptOrganizationId?: string): Promise<boolean> {
  const taken = await db
    .select({ id: schema.professionals.id })
    .from(schema.professionals)
    .where(eq(schema.professionals.slug, slug))
    .union(
      db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(
          exceptOrganizationId
            ? and(eq(schema.organizations.slug, slug), ne(schema.organizations.id, exceptOrganizationId))
            : eq(schema.organizations.slug, slug),
        ),
    )
    .limit(1);
  return taken.length > 0;
}

export async function getOrganization(id: string): Promise<Organization> {
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, id) });
  if (!org) throw new Error(`No existe la organización ${id}`);
  return org;
}

export async function listMembers(organizationId: string) {
  return db
    .select()
    .from(schema.professionals)
    .where(eq(schema.professionals.organizationId, organizationId))
    .orderBy(asc(schema.professionals.displayName));
}

/** Convierte la organización de un independiente en un centro con nombre y dirección propios. */
export async function convertToCentro(pro: Professional, input: { name: string; slug: string }) {
  const org = await getOrganization(pro.organizationId);
  if (!pro.isAdmin) throw new CentroError("Solo quien administra puede hacer esto");
  if (org.kind === "centro") throw new CentroError("Ya sos parte de un centro");
  if (input.slug === pro.slug || (await isSlugTaken(input.slug, org.id))) {
    throw new CentroError(`La dirección orgatodo.com/${input.slug} ya está tomada`);
  }
  await db
    .update(schema.organizations)
    .set({
      kind: "centro",
      name: input.name,
      slug: input.slug,
      address: pro.address,
      phone: pro.phone,
      category: pro.category,
      city: pro.city,
      province: pro.province,
    })
    .where(eq(schema.organizations.id, org.id));
}

export function inviteUrl(token: string): string {
  return `${appUrl()}/unirme/${token}`;
}

/** Crea la invitación, o renueva la que ya estaba pendiente para ese email. */
export async function createInvite(admin: Professional, input: { email: string; name?: string }) {
  const org = await getOrganization(admin.organizationId);
  if (!admin.isAdmin || org.kind !== "centro") throw new CentroError("Solo quien administra el centro puede invitar");
  const [member] = await db
    .select({ id: schema.professionals.id })
    .from(schema.professionals)
    .where(and(eq(schema.professionals.organizationId, org.id), eq(schema.professionals.email, input.email)));
  if (member) throw new CentroError("Esa persona ya es parte del centro");

  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  const [invite] = await db
    .insert(schema.organizationInvites)
    .values({ organizationId: org.id, email: input.email, name: input.name || null, invitedBy: admin.id, expiresAt })
    .onConflictDoUpdate({
      target: [schema.organizationInvites.organizationId, schema.organizationInvites.email],
      targetWhere: isNull(schema.organizationInvites.acceptedAt),
      set: { expiresAt, name: input.name || null, invitedBy: admin.id },
    })
    .returning();
  return { invite, organization: org };
}

/** Invitación vigente con su centro, o null si no existe, venció o ya se usó. */
export async function findOpenInvite(token: string, now = new Date()) {
  const [row] = await db
    .select({ invite: schema.organizationInvites, organization: schema.organizations })
    .from(schema.organizationInvites)
    .innerJoin(schema.organizations, eq(schema.organizationInvites.organizationId, schema.organizations.id))
    .where(
      and(
        eq(schema.organizationInvites.token, token),
        isNull(schema.organizationInvites.acceptedAt),
        gt(schema.organizationInvites.expiresAt, now),
      ),
    );
  return row ?? null;
}

/** Marca la invitación como usada; falla si otra persona la usó al mismo tiempo. */
export async function claimInvite(tx: Tx, token: string, now = new Date()) {
  const [invite] = await tx
    .update(schema.organizationInvites)
    .set({ acceptedAt: now })
    .where(
      and(
        eq(schema.organizationInvites.token, token),
        isNull(schema.organizationInvites.acceptedAt),
        gt(schema.organizationInvites.expiresAt, now),
      ),
    )
    .returning();
  if (!invite) throw new CentroError("La invitación venció o ya se usó. Pedile a tu centro que te mande otra.");
  return invite;
}

/** Borra la organización si quedó sin nadie. */
async function dropIfEmpty(tx: Tx, organizationId: string) {
  const [{ members }] = await tx
    .select({ members: count() })
    .from(schema.professionals)
    .where(eq(schema.professionals.organizationId, organizationId));
  if (members === 0) await tx.delete(schema.organizations).where(eq(schema.organizations.id, organizationId));
}

/**
 * Suma a un profesional que ya tiene cuenta al centro de la invitación. Se lleva sus turnos,
 * clientes, servicios y su conexión con ARCA: sigue facturando con su propio CUIT.
 */
export async function joinWithInvite(pro: Professional, token: string) {
  return db.transaction(async (tx) => {
    const invite = await claimInvite(tx, token);
    if (invite.organizationId === pro.organizationId) throw new CentroError("Ya sos parte de este centro");
    const [{ others }] = await tx
      .select({ others: count() })
      .from(schema.professionals)
      .where(and(eq(schema.professionals.organizationId, pro.organizationId), ne(schema.professionals.id, pro.id)));
    if (others > 0) throw new CentroError("Ya sos parte de otro centro. Salí de ese centro antes de sumarte a uno nuevo.");

    await tx
      .update(schema.professionals)
      .set({ organizationId: invite.organizationId, isAdmin: false })
      .where(eq(schema.professionals.id, pro.id));
    await dropIfEmpty(tx, pro.organizationId);
    return invite;
  });
}

/** Saca a un profesional del centro: vuelve a ser independiente con su misma página y sus datos. */
export async function leaveCentro(pro: Professional) {
  await db.transaction(async (tx) => {
    // Bloquea al equipo para que dos administradores no se saquen el permiso a la vez.
    const team = await tx
      .select()
      .from(schema.professionals)
      .where(eq(schema.professionals.organizationId, pro.organizationId))
      .for("update");
    const others = team.filter((p) => p.id !== pro.id);
    if (others.length > 0 && pro.isAdmin && !others.some((p) => p.isAdmin)) {
      throw new CentroError("Antes de salir, dale la administración a otra persona del equipo.");
    }
    const slug = await freeOrganizationSlug(tx, pro.slug);
    const [org] = await tx
      .insert(schema.organizations)
      .values({ slug, name: pro.displayName, kind: "independiente" })
      .returning();
    await tx
      .update(schema.professionals)
      .set({ organizationId: org.id, isAdmin: true })
      .where(eq(schema.professionals.id, pro.id));
    await dropIfEmpty(tx, pro.organizationId);
  });
}

/** El slug de la organización de un independiente no se muestra; solo tiene que ser único. */
async function freeOrganizationSlug(tx: Tx, base: string): Promise<string> {
  for (let i = 0; ; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const [taken] = await tx
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, slug));
    if (!taken) return slug;
  }
}

/** Da o quita el permiso de administrar. Siempre queda al menos una persona que administra. */
export async function setAdmin(admin: Professional, memberId: string, isAdmin: boolean) {
  if (!admin.isAdmin) throw new CentroError("Solo quien administra el centro puede cambiar permisos");
  await db.transaction(async (tx) => {
    const team = await tx
      .select()
      .from(schema.professionals)
      .where(eq(schema.professionals.organizationId, admin.organizationId))
      .for("update");
    const member = team.find((p) => p.id === memberId);
    if (!member) throw new CentroError("Esa persona no es parte del centro");
    if (!isAdmin && !team.some((p) => p.isAdmin && p.id !== memberId)) {
      throw new CentroError("El centro tiene que tener al menos una persona que lo administre");
    }
    await tx.update(schema.professionals).set({ isAdmin }).where(eq(schema.professionals.id, memberId));
  });
}

/** Un administrador saca a alguien del equipo. */
export async function removeMember(admin: Professional, memberId: string) {
  if (!admin.isAdmin) throw new CentroError("Solo quien administra el centro puede sacar a alguien");
  if (memberId === admin.id) throw new CentroError("Para irte del centro usá «Salir del centro»");
  const member = await db.query.professionals.findFirst({
    where: and(eq(schema.professionals.id, memberId), eq(schema.professionals.organizationId, admin.organizationId)),
  });
  if (!member) throw new CentroError("Esa persona no es parte del centro");
  await leaveCentro(member);
}

/** Página pública de un centro con sus profesionales publicados y sus servicios. */
export async function getPublishedCentro(slug: string) {
  const organization = await db.query.organizations.findFirst({
    where: and(
      eq(schema.organizations.slug, slug),
      eq(schema.organizations.kind, "centro"),
      eq(schema.organizations.published, true),
    ),
  });
  if (!organization) return null;
  const rows = await db
    .select({ professional: schema.professionals, service: schema.services })
    .from(schema.professionals)
    .leftJoin(
      schema.services,
      and(eq(schema.services.professionalId, schema.professionals.id), eq(schema.services.active, true)),
    )
    .where(and(eq(schema.professionals.organizationId, organization.id), eq(schema.professionals.published, true)))
    .orderBy(asc(schema.professionals.displayName), asc(schema.services.position), asc(schema.services.name));

  const team = new Map<string, { professional: Professional; services: (typeof schema.services.$inferSelect)[] }>();
  for (const { professional, service } of rows) {
    const entry = team.get(professional.id) ?? { professional, services: [] };
    if (service) entry.services.push(service);
    team.set(professional.id, entry);
  }
  return { organization, team: [...team.values()] };
}

/** Centro publicado al que pertenece un profesional, para enlazarlo desde su página. */
export async function getPublishedCentroOf(pro: Professional) {
  const org = await db.query.organizations.findFirst({
    where: and(
      eq(schema.organizations.id, pro.organizationId),
      eq(schema.organizations.kind, "centro"),
      eq(schema.organizations.published, true),
    ),
  });
  return org ?? null;
}
