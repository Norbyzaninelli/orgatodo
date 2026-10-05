"use server";

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { getAuth } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { CentroError, claimInvite, findOpenInvite, isSlugTaken } from "@/lib/centros";
import { isValidSlug } from "@/lib/slugs";

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre").max(120),
  email: z.email("Ingresá un email válido").trim().toLowerCase(),
  password: z.string().min(8, "La contraseña tiene que tener al menos 8 caracteres").max(128),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidSlug, "Usá entre 3 y 40 letras, números o guiones, sin espacios"),
  /** Token de la invitación a un centro, si se registra desde ese link. */
  invitacion: z.string().regex(/^[0-9a-f]{48}$/).optional().or(z.literal("")),
});

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, slug, invitacion } = parsed.data;

  if (await isSlugTaken(slug)) return { error: `La dirección orgatodo.com/${slug} ya está tomada` };
  if (invitacion && !(await findOpenInvite(invitacion))) {
    return { error: "La invitación venció o ya se usó. Pedile a tu centro que te mande otra." };
  }

  let userId: string;
  try {
    const result = await getAuth().api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    });
    userId = result.user.id;
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.status === "UNPROCESSABLE_ENTITY" ? "Ya hay una cuenta con ese email" : error.message };
    }
    throw error;
  }

  try {
    await createProfessional(userId, name, email, slug, invitacion || undefined);
  } catch (error) {
    // Sin perfil la cuenta no sirve: se borra para que pueda volver a registrarse con el mismo email.
    await db.delete(schema.user).where(eq(schema.user.id, userId));
    if (error instanceof CentroError) return { error: error.message };
    if (isUniqueViolation(error)) return { error: `La dirección orgatodo.com/${slug} ya está tomada` };
    throw error;
  }

  redirect("/panel");
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function createProfessional(userId: string, name: string, email: string, slug: string, inviteToken?: string) {
  await db.transaction(async (tx) => {
    // Con invitación entra al equipo del centro; si no, arranca como independiente y administra lo suyo.
    let organizationId: string;
    if (inviteToken) {
      organizationId = (await claimInvite(tx, inviteToken)).organizationId;
    } else {
      [{ id: organizationId }] = await tx.insert(schema.organizations).values({ slug, name }).returning();
    }
    const [pro] = await tx
      .insert(schema.professionals)
      .values({ organizationId, userId, slug, displayName: name, email, isAdmin: !inviteToken })
      .returning();
    // Horario inicial de lunes a viernes de 9 a 18, para que solo tenga que ajustarlo.
    await tx.insert(schema.availabilityRules).values(
      [1, 2, 3, 4, 5].map((weekday) => ({ professionalId: pro.id, weekday, startMinute: 540, endMinute: 1080 })),
    );
  });
}

const signInSchema = z.object({
  email: z.email("Ingresá un email válido").trim().toLowerCase(),
  password: z.string().min(1, "Ingresá tu contraseña"),
  volver: z.string().optional(),
});

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await getAuth().api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) return { error: "El email o la contraseña no son correctos" };
    throw error;
  }

  const back = parsed.data.volver;
  // Solo se vuelve a páginas del panel, nunca a otra dirección.
  redirect(back && /^\/(panel(\/[a-z-]*)?|unirme\/[0-9a-f]{48})$/.test(back) ? back : "/panel");
}

export async function signOutAction() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/");
}
