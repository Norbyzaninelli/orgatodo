const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatTime(instant: Date, timezone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(instant);
}

export function formatLongDate(instant: Date, timezone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  }).format(instant);
}

/** Etiqueta corta para una fecha local YYYY-MM-DD, por ejemplo "lun 5 oct". */
export function formatDayChip(localDate: string): { weekday: string; day: string; month: string } {
  // Mediodía UTC cae en el mismo día en cualquier zona de Argentina.
  const d = new Date(`${localDate}T12:00:00Z`);
  const part = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-AR", { ...opts, timeZone: "UTC" }).format(d).replace(".", "");
  return { weekday: part({ weekday: "short" }), day: part({ day: "numeric" }), month: part({ month: "short" }) };
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
