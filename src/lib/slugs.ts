/** Direcciones que no puede tomar un profesional porque las usa la plataforma. */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "ayuda", "cuenta", "facturacion", "ingresar", "login", "panel",
  "planes", "precios", "registro", "soporte", "turno", "turnos", "unirme", "factura",
]);

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) && !RESERVED_SLUGS.has(slug);
}
