import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import type { Professional } from "@/db/schema";
import {
  CentroError,
  convertToCentro,
  createInvite,
  findOpenInvite,
  joinWithInvite,
  leaveCentro,
  removeMember,
  setAdmin,
} from "./centros";

// Usa la base de datos de desarrollo o la de CI; cada corrida crea y borra sus propios datos.
const run = randomBytes(3).toString("hex");
const created: string[] = [];

async function independent(name: string): Promise<Professional> {
  const slug = `t-${run}-${name}`;
  const [org] = await db.insert(schema.organizations).values({ slug, name }).returning();
  const [pro] = await db
    .insert(schema.professionals)
    .values({ organizationId: org.id, slug, displayName: name, email: `${slug}@test.local`, isAdmin: true })
    .returning();
  created.push(pro.id);
  return pro;
}

async function reload(pro: Professional): Promise<Professional> {
  const fresh = await db.query.professionals.findFirst({ where: eq(schema.professionals.id, pro.id) });
  return fresh!;
}

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const pros = await db.select().from(schema.professionals).where(inArray(schema.professionals.id, created));
  await db.delete(schema.professionals).where(inArray(schema.professionals.id, created));
  const orgs = [...new Set(pros.map((p) => p.organizationId))];
  if (orgs.length > 0) await db.delete(schema.organizations).where(inArray(schema.organizations.id, orgs));
});

describe.skipIf(!process.env.DATABASE_URL)("centros", () => {
  it("arma un centro, suma profesionales y los deja salir con sus datos", async () => {
    let ana = await independent("ana");
    let beto = await independent("beto");
    const betoOrg = beto.organizationId;

    await convertToCentro(ana, { name: "Centro Prueba", slug: `t-${run}-centro` });
    await expect(convertToCentro(ana, { name: "Otro", slug: `t-${run}-otro` })).rejects.toThrow(CentroError);
    // La dirección del centro no puede ser la de un profesional.
    await expect(convertToCentro(beto, { name: "X", slug: ana.slug })).rejects.toThrow(/tomada/);

    const { invite } = await createInvite(ana, { email: beto.email, name: "Beto" });
    // Reinvitar al mismo email renueva la misma invitación.
    const again = await createInvite(ana, { email: beto.email });
    expect(again.invite.id).toBe(invite.id);
    await expect(createInvite(beto, { email: "x@test.local" })).rejects.toThrow(CentroError);

    await joinWithInvite(beto, invite.token);
    beto = await reload(beto);
    expect(beto.organizationId).toBe(ana.organizationId);
    expect(beto.isAdmin).toBe(false);
    expect(await findOpenInvite(invite.token)).toBeNull();
    // Su organización de independiente quedó vacía y se borró.
    expect(await db.query.organizations.findFirst({ where: eq(schema.organizations.id, betoOrg) })).toBeUndefined();
    await expect(createInvite(ana, { email: beto.email })).rejects.toThrow(/ya es parte/);

    // La única administradora no puede irse ni sacarse el permiso.
    await expect(leaveCentro(ana)).rejects.toThrow(/dale la administración/);
    await expect(setAdmin(ana, ana.id, false)).rejects.toThrow(/al menos una/);

    await setAdmin(ana, beto.id, true);
    await leaveCentro(ana);
    ana = await reload(ana);
    beto = await reload(beto);
    expect(ana.organizationId).not.toBe(beto.organizationId);
    expect(ana.isAdmin).toBe(true);

    await expect(removeMember(beto, ana.id)).rejects.toThrow(/no es parte/);
  });

  it("no deja usar una invitación dos veces", async () => {
    const admin = await independent("carla");
    await convertToCentro(admin, { name: "Centro Dos", slug: `t-${run}-centro2` });
    const { invite } = await createInvite(admin, { email: "dani@test.local" });
    const [dani, eva] = await Promise.all([independent("dani"), independent("eva")]);
    const results = await Promise.allSettled([joinWithInvite(dani, invite.token), joinWithInvite(eva, invite.token)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("no deja sumarse a otro centro sin salir del actual", async () => {
    const [fede, gabi] = await Promise.all([independent("fede"), independent("gabi")]);
    await convertToCentro(fede, { name: "Centro Tres", slug: `t-${run}-centro3` });
    await joinWithInvite(gabi, (await createInvite(fede, { email: gabi.email })).invite.token);

    const hugo = await independent("hugo");
    await convertToCentro(hugo, { name: "Centro Cuatro", slug: `t-${run}-centro4` });
    const { invite } = await createInvite(hugo, { email: fede.email });
    await expect(joinWithInvite(await reload(fede), invite.token)).rejects.toThrow(/otro centro/);
  });
});
