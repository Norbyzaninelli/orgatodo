/** Rubros para el buscador. Se guardan por su clave, así se pueden renombrar sin tocar datos. */
export const RUBROS = [
  { key: "kinesiologia", label: "Kinesiología", group: "Salud" },
  { key: "psicologia", label: "Psicología", group: "Salud" },
  { key: "nutricion", label: "Nutrición", group: "Salud" },
  { key: "odontologia", label: "Odontología", group: "Salud" },
  { key: "medicina", label: "Medicina", group: "Salud" },
  { key: "fonoaudiologia", label: "Fonoaudiología", group: "Salud" },
  { key: "podologia", label: "Podología", group: "Salud" },
  { key: "peluqueria", label: "Peluquería", group: "Belleza" },
  { key: "barberia", label: "Barbería", group: "Belleza" },
  { key: "unas", label: "Uñas", group: "Belleza" },
  { key: "estetica", label: "Estética", group: "Belleza" },
  { key: "depilacion", label: "Depilación", group: "Belleza" },
  { key: "cejas-pestanas", label: "Cejas y pestañas", group: "Belleza" },
  { key: "maquillaje", label: "Maquillaje", group: "Belleza" },
  { key: "masajes", label: "Masajes", group: "Bienestar" },
  { key: "yoga-pilates", label: "Yoga y pilates", group: "Bienestar" },
  { key: "entrenamiento", label: "Entrenamiento personal", group: "Bienestar" },
  { key: "clases", label: "Clases particulares", group: "Otros" },
  { key: "asesoria", label: "Asesoría profesional", group: "Otros" },
  { key: "otros", label: "Otros servicios", group: "Otros" },
] as const;

export type RubroKey = (typeof RUBROS)[number]["key"];

const RUBRO_KEYS = new Set<string>(RUBROS.map((r) => r.key));

export function isRubro(value: unknown): value is RubroKey {
  return typeof value === "string" && RUBRO_KEYS.has(value);
}

export function rubroLabel(key: string | null | undefined): string | null {
  return RUBROS.find((r) => r.key === key)?.label ?? null;
}

/** Rubros agrupados para armar un select con optgroups. */
export function rubrosByGroup() {
  const groups = new Map<string, (typeof RUBROS)[number][]>();
  for (const rubro of RUBROS) groups.set(rubro.group, [...(groups.get(rubro.group) ?? []), rubro]);
  return [...groups.entries()];
}

export const PROVINCIAS = [
  "Ciudad de Buenos Aires", "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes",
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén",
  "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero",
  "Tierra del Fuego", "Tucumán",
] as const;

export function isProvincia(value: unknown): value is (typeof PROVINCIAS)[number] {
  return typeof value === "string" && (PROVINCIAS as readonly string[]).includes(value);
}
