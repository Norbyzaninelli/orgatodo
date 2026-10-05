import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Professional } from "@/db/schema";

/**
 * Profesionales cuyos turnos puede manejar alguien: los propios y, si administra un centro,
 * los de todo el equipo. La facturación nunca entra acá: cada profesional factura lo suyo.
 */
export async function manageableProfessionals(actor: Professional): Promise<Professional[]> {
  if (!actor.isAdmin) return [actor];
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, actor.organizationId) });
  if (org?.kind !== "centro") return [actor];
  return db.select().from(schema.professionals).where(eq(schema.professionals.organizationId, actor.organizationId));
}
