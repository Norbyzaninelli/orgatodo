"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireProfessional } from "@/lib/auth";
import {
  CentroError,
  convertToCentro,
  createInvite,
  getOrganization,
  inviteUrl,
  isSlugTaken,
  leaveCentro,
  removeMember,
  setAdmin,
} from "@/lib/centros";
import type { FormState } from "@/lib/form-state";
import { textToHtml } from "@/lib/notifications/messages";
import { sendEmail } from "@/lib/notifications/providers";
import { isValidSlug } from "@/lib/slugs";

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidSlug, "Usá entre 3 y 40 letras, números o guiones, sin espacios");

function revalidateCentro(slug?: string) {
  revalidatePath("/panel", "layout");
  if (slug) revalidatePath(`/${slug}`);
}

async function requireAdmin() {
  const pro = await requireProfessional();
  const org = await getOrganization(pro.organizationId);
  if (!pro.isAdmin || org.kind !== "centro") throw new CentroError("Solo quien administra el centro puede hacer esto");
  return { pro, org };
}

const convertSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del centro").max(120),
  slug: slugField,
});

export async function convertToCentroAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pro = await requireProfessional();
  const parsed = convertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await convertToCentro(pro, parsed.data);
  } catch (error) {
    if (error instanceof CentroError) return { error: error.message };
    throw error;
  }
  revalidateCentro();
  redirect("/panel/centro");
}

const centroSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del centro").max(120),
  slug: slugField,
  description: z.string().trim().max(600),
  address: z.string().trim().max(200),
  phone: z.string().trim().max(30),
});

export async function saveCentroAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { org } = await requireAdmin();
  const parsed = centroSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, slug, description, address, phone } = parsed.data;
  if (slug !== org.slug && (await isSlugTaken(slug, org.id))) {
    return { error: `La dirección orgatodo.com/${slug} ya está tomada` };
  }
  await db
    .update(schema.organizations)
    .set({ name, slug, description: description || null, address: address || null, phone: phone || null })
    .where(eq(schema.organizations.id, org.id));
  revalidateCentro(org.slug);
  revalidateCentro(slug);
  return { ok: "Datos del centro guardados" };
}

export async function setCentroPublishedAction(formData: FormData) {
  const { org } = await requireAdmin();
  const published = formData.get("published") === "true";
  await db.update(schema.organizations).set({ published }).where(eq(schema.organizations.id, org.id));
  revalidateCentro(org.slug);
}

const inviteSchema = z.object({
  email: z.email("Ingresá un email válido").trim().toLowerCase(),
  name: z.string().trim().max(120).optional(),
});

export async function inviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { pro } = await requireAdmin();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let result;
  try {
    result = await createInvite(pro, parsed.data);
  } catch (error) {
    if (error instanceof CentroError) return { error: error.message };
    throw error;
  }
  const { invite, organization } = result;
  const greeting = invite.name ? `Hola ${invite.name}` : "Hola";
  const text = [
    `${greeting}, ${pro.displayName} te invita a sumarte a ${organization.name} en ORGATODO.`,
    "Vas a tener tu agenda, tus turnos y tu facturación con tu propio CUIT, y aparecer en la página del centro.",
    `Entrá con este link para sumarte: ${inviteUrl(invite.token)}`,
  ].join("\n\n");
  try {
    await sendEmail({ to: invite.email, subject: `Invitación a ${organization.name}`, text, html: textToHtml(text) });
  } catch (error) {
    console.error(`[centros] no se pudo mandar la invitación ${invite.id}`, error);
  }
  revalidatePath("/panel/centro");
  return { ok: `Le mandamos la invitación a ${invite.email}. También podés pasarle el link por WhatsApp.` };
}

export async function revokeInviteAction(formData: FormData) {
  const { org } = await requireAdmin();
  const id = z.uuid().parse(formData.get("inviteId"));
  await db
    .delete(schema.organizationInvites)
    .where(
      and(
        eq(schema.organizationInvites.id, id),
        eq(schema.organizationInvites.organizationId, org.id),
        isNull(schema.organizationInvites.acceptedAt),
      ),
    );
  revalidatePath("/panel/centro");
}

/** Para las acciones de botones sueltos: el error se muestra con ?error= en la página del centro. */
function backWithError(error: unknown): never {
  if (error instanceof CentroError) redirect(`/panel/centro?error=${encodeURIComponent(error.message)}`);
  throw error;
}

export async function setAdminAction(formData: FormData) {
  const { pro } = await requireAdmin();
  const memberId = z.uuid().parse(formData.get("professionalId"));
  try {
    await setAdmin(pro, memberId, formData.get("isAdmin") === "true");
  } catch (error) {
    backWithError(error);
  }
  revalidateCentro();
}

export async function removeMemberAction(formData: FormData) {
  const { pro, org } = await requireAdmin();
  const memberId = z.uuid().parse(formData.get("professionalId"));
  try {
    await removeMember(pro, memberId);
  } catch (error) {
    backWithError(error);
  }
  revalidateCentro(org.slug);
}

export async function leaveCentroAction() {
  const pro = await requireProfessional();
  const org = await getOrganization(pro.organizationId);
  if (org.kind !== "centro") redirect("/panel/centro");
  try {
    await leaveCentro(pro);
  } catch (error) {
    backWithError(error);
  }
  revalidateCentro(org.slug);
  redirect("/panel/centro");
}
