/** "09:30" → 570 */
export function timeToMinutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  return value.trim() === "24:00" ? 1440 : null;
}

/** 570 → "09:30" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

/** Orden de la semana como se muestra en Argentina: de lunes a domingo. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** "25.000,50" o "25000" → centavos. */
export function parsePriceToCents(value: string): number | null {
  const normalized = value.trim().replace(/\$|\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function centsToInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(whole) : `${whole},${String(rest).padStart(2, "0")}`;
}
