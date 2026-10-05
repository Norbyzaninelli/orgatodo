import { randomBytes } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { normalize, rubrosMatching, searchListings } from "./buscador";

describe("texto del buscador", () => {
  it("compara sin acentos ni mayúsculas", () => {
    expect(normalize("  Kinesiología ")).toBe("kinesiologia");
  });

  it("reconoce rubros por parte del nombre", () => {
    expect(rubrosMatching("kinesio")).toEqual(["kinesiologia"]);
    expect(rubrosMatching("UÑAS")).toEqual(["unas"]);
    expect(rubrosMatching("ab")).toEqual([]);
  });
});

// Usa la base de datos de desarrollo o la de CI; crea y borra sus propios datos.
describe.skipIf(!process.env.DATABASE_URL)("búsqueda", () => {
  const run = randomBytes(3).toString("hex");
  const orgIds: string[] = [];
  const tag = `zz${run}`;

  async function org(values: Partial<typeof schema.organizations.$inferInsert> & { slug: string; name: string }) {
    const [row] = await db.insert(schema.organizations).values(values).returning();
    orgIds.push(row.id);
    return row;
  }

  async function pro(
    organizationId: string,
    values: Partial<typeof schema.professionals.$inferInsert> & { slug: string; displayName: string },
    service = "Sesión",
  ) {
    const [row] = await db
      .insert(schema.professionals)
      .values({ organizationId, email: `${values.slug}@test.local`, published: true, ...values })
      .returning();
    await db.insert(schema.services).values({ professionalId: row.id, name: service, durationMinutes: 30, priceCents: 100000 });
    return row;
  }

  beforeAll(async () => {
    const indep = await org({ slug: `${tag}-ana`, name: "Ana" });
    await pro(indep.id, {
      slug: `${tag}-ana`,
      displayName: `Ana ${tag}`,
      category: "kinesiologia",
      city: "Palermo",
      province: "Ciudad de Buenos Aires",
    });
    const sinPublicar = await org({ slug: `${tag}-oculto`, name: "Oculto" });
    await pro(sinPublicar.id, { slug: `${tag}-oculto`, displayName: `Oculto ${tag}`, category: "kinesiologia", published: false });
    const centro = await org({
      slug: `${tag}-centro`,
      name: `Centro ${tag}`,
      kind: "centro",
      published: true,
      category: "estetica",
      city: "Nueva Córdoba",
      province: "Córdoba",
    });
    await pro(centro.id, { slug: `${tag}-beto`, displayName: `Beto ${tag}` }, "Limpieza facial");
    await pro(centro.id, { slug: `${tag}-caro`, displayName: `Caro ${tag}`, category: "unas" }, "Esmaltado semipermanente");
  });

  afterAll(async () => {
    await db.delete(schema.organizations).where(inArray(schema.organizations.id, orgIds));
  });

  const slugs = async (filters: Parameters<typeof searchListings>[0]) =>
    (await searchListings(filters)).map((l) => l.slug).filter((s) => s.startsWith(tag));

  it("busca por nombre sin mostrar páginas sin publicar", async () => {
    expect(await slugs({ q: tag })).toEqual([`${tag}-ana`, `${tag}-centro`]);
  });

  it("filtra por rubro, usando el del centro si el profesional no eligió", async () => {
    expect(await slugs({ q: tag, rubro: "kinesiologia" })).toEqual([`${tag}-ana`]);
    const estetica = await searchListings({ q: tag, rubro: "estetica" });
    expect(estetica.map((l) => [l.slug, l.team, l.rubro, l.href])).toEqual([
      [`${tag}-centro`, [`Beto ${tag}`], "Estética", `/${tag}-centro#${tag}-beto`],
    ]);
    expect((await searchListings({ q: tag })).find((l) => l.kind === "centro")?.rubro).toBe("Estética · Uñas");
    expect(await slugs({ q: tag, rubro: "unas" })).toEqual([`${tag}-centro`]);
  });

  it("filtra por zona sin acentos", async () => {
    expect(await slugs({ q: tag, zona: "cordoba" })).toEqual([`${tag}-centro`]);
    expect(await slugs({ q: tag, zona: "palermo" })).toEqual([`${tag}-ana`]);
  });

  it("encuentra por servicio y por nombre del rubro", async () => {
    expect(await slugs({ q: "semipermanente", zona: "nueva cordoba" })).toEqual([`${tag}-centro`]);
    expect(await slugs({ q: "kinesiologia", zona: "palermo" })).toEqual([`${tag}-ana`]);
  });

  it("no se rompe con comodines en el texto", async () => {
    expect(await slugs({ q: "%" })).toEqual([]);
  });
});
