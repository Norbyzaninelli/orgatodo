import { and, asc, eq, inArray, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { combineRatings, ratingsFor, type RatingSummary } from "./resenas";
import { RUBROS, isRubro, rubroLabel } from "./rubros";

export interface SearchFilters {
  q?: string;
  rubro?: string;
  zona?: string;
}

export interface ListingService {
  name: string;
  priceCents: number;
}

export interface Listing {
  kind: "profesional" | "centro";
  slug: string;
  name: string;
  description: string | null;
  rubro: string | null;
  zona: string | null;
  /** En un centro: los profesionales que coinciden con la búsqueda. */
  team: string[];
  /** Link de la tarjeta; en un centro con un solo profesional encontrado, va directo a su sección. */
  href: string;
  services: ListingService[];
  fromPriceCents: number | null;
  rating: RatingSummary | null;
}

const MAX_RESULTS = 60;

/** Saca acentos y pasa a minúsculas, igual que unaccent + ilike en la base. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Patrón para ilike con los comodines del texto escapados. */
function pattern(text: string): string {
  return `%${normalize(text).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function matches(column: AnyColumn, text: string): SQL {
  return sql`unaccent(coalesce(${column}, '')) ilike ${pattern(text)}`;
}

/** Rubros cuyo nombre contiene el texto buscado: "kinesio" incluye a quienes eligieron Kinesiología. */
export function rubrosMatching(text: string): string[] {
  const needle = normalize(text);
  if (needle.length < 3) return [];
  return RUBROS.filter((r) => normalize(r.label).includes(needle)).map((r) => r.key);
}

export function formatZona(city: string | null, province: string | null): string | null {
  return [city, province].filter(Boolean).join(", ") || null;
}

/**
 * Busca profesionales publicados con al menos un servicio activo. Los que trabajan en un centro
 * publicado se muestran dentro de la tarjeta del centro.
 */
export async function searchListings(filters: SearchFilters): Promise<Listing[]> {
  const p = schema.professionals;
  const o = schema.organizations;
  const q = filters.q?.trim().slice(0, 80) ?? "";
  const zona = filters.zona?.trim().slice(0, 80) ?? "";
  const rubro = isRubro(filters.rubro) ? filters.rubro : null;

  const conditions: SQL[] = [
    eq(p.published, true),
    sql`exists (select 1 from ${schema.services} s where s.professional_id = ${p.id} and s.active)`,
  ];
  // El rubro del profesional manda; si no eligió, vale el de su centro.
  const effectiveRubro = sql`coalesce(${p.category}, case when ${o.kind} = 'centro' then ${o.category} end)`;
  if (rubro) conditions.push(sql`${effectiveRubro} = ${rubro}`);
  if (zona) {
    conditions.push(
      or(
        matches(p.city, zona),
        matches(p.province, zona),
        matches(p.address, zona),
        and(eq(o.kind, "centro"), or(matches(o.city, zona), matches(o.province, zona), matches(o.address, zona))),
      )!,
    );
  }
  if (q) {
    const byText = [
      matches(p.displayName, q),
      matches(p.bio, q),
      and(eq(o.kind, "centro"), or(matches(o.name, q), matches(o.description, q)))!,
      sql`exists (select 1 from ${schema.services} s where s.professional_id = ${p.id} and s.active and unaccent(s.name) ilike ${pattern(q)})`,
    ];
    const rubros = rubrosMatching(q);
    if (rubros.length > 0) byText.push(sql`${effectiveRubro} in ${rubros}`);
    conditions.push(or(...byText)!);
  }

  const rows = await db
    .select({ professional: p, organization: o })
    .from(p)
    .innerJoin(o, eq(p.organizationId, o.id))
    .where(and(...conditions))
    .orderBy(asc(p.displayName))
    .limit(MAX_RESULTS * 3);
  if (rows.length === 0) return [];

  const services = await db
    .select({
      professionalId: schema.services.professionalId,
      name: schema.services.name,
      priceCents: schema.services.priceCents,
    })
    .from(schema.services)
    .where(
      and(
        inArray(
          schema.services.professionalId,
          rows.map((r) => r.professional.id),
        ),
        eq(schema.services.active, true),
      ),
    )
    .orderBy(asc(schema.services.position), asc(schema.services.name));
  const servicesOf = (id: string) => services.filter((s) => s.professionalId === id);

  const listings: Listing[] = [];
  // Profesionales de cada tarjeta, para sumar sus reseñas.
  const membersOf = new Map<Listing, string[]>();
  const ratings = await ratingsFor(rows.map((r) => r.professional.id));
  const centros = new Map<string, Listing>();
  for (const { professional, organization } of rows) {
    const own = servicesOf(professional.id);
    if (organization.kind === "centro" && organization.published) {
      let centro = centros.get(organization.id);
      if (!centro) {
        centro = {
          kind: "centro",
          slug: organization.slug,
          name: organization.name,
          description: organization.description,
          rubro: null,
          zona: formatZona(organization.city, organization.province),
          team: [],
          href: `/${organization.slug}`,
          services: [],
          fromPriceCents: null,
          rating: null,
        };
        centros.set(organization.id, centro);
        listings.push(centro);
      }
      centro.team.push(professional.displayName);
      membersOf.set(centro, [...(membersOf.get(centro) ?? []), professional.id]);
      centro.services.push(...own);
      // Muestra los rubros de quienes coinciden, no solo el del centro.
      const label = rubroLabel(professional.category ?? organization.category);
      const labels = centro.rubro ? centro.rubro.split(" · ") : [];
      if (label && !labels.includes(label)) centro.rubro = [...labels, label].join(" · ");
      centro.href = centro.team.length === 1 ? `/${organization.slug}#${professional.slug}` : `/${organization.slug}`;
    } else {
      listings.push({
        kind: "profesional",
        slug: professional.slug,
        name: professional.displayName,
        description: professional.bio,
        rubro: rubroLabel(professional.category),
        zona: formatZona(professional.city, professional.province),
        team: [],
        href: `/${professional.slug}`,
        services: own,
        fromPriceCents: null,
        rating: ratings.get(professional.id) ?? null,
      });
    }
  }
  for (const listing of listings) {
    const members = membersOf.get(listing);
    if (members) listing.rating = combineRatings(members.map((id) => ratings.get(id)));
    listing.fromPriceCents = listing.services.length ? Math.min(...listing.services.map((s) => s.priceCents)) : null;
    listing.services = listing.services.slice(0, 3);
  }
  return listings.slice(0, MAX_RESULTS);
}
