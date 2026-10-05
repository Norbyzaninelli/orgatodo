import type { LocalDate } from "@/lib/agenda/slots";

/** Mes en formato YYYY-MM. */
export type Month = string;

export const PAYMENT_METHODS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
  tarjeta: "Tarjeta",
  otro: "Otro",
} as const;

export const EXPENSE_CATEGORIES = {
  alquiler: "Alquiler",
  insumos: "Insumos",
  monotributo: "Monotributo",
  otros: "Otros",
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export function isValidMonth(value: unknown): value is Month {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthOf(date: LocalDate): Month {
  return date.slice(0, 7);
}

export function addMonths(month: Month, delta: number): Month {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Primer día del mes y primer día del mes siguiente, para filtrar con [desde, hasta). */
export function monthBounds(month: Month): { first: LocalDate; next: LocalDate } {
  return { first: `${month}-01`, next: `${addMonths(month, 1)}-01` };
}

/** "octubre de 2026" */
export function formatMonth(month: Month): string {
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-15T12:00:00Z`),
  );
}

/** "oct" */
export function formatMonthShort(month: Month): string {
  return new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" })
    .format(new Date(`${month}-15T12:00:00Z`))
    .replace(".", "");
}

export interface IncomeItem {
  /** Día local en que se hizo el turno. */
  date: LocalDate;
  priceCents: number;
  paid: boolean;
}

export interface ExpenseItem {
  date: LocalDate;
  category: ExpenseCategory;
  amountCents: number;
}

export interface MonthSummary {
  month: Month;
  incomeCents: number;
  paidCents: number;
  unpaidCents: number;
  sessions: number;
  expensesCents: number;
  resultCents: number;
  byCategory: Record<ExpenseCategory, number>;
}

function emptyCategories(): Record<ExpenseCategory, number> {
  return { alquiler: 0, insumos: 0, monotributo: 0, otros: 0 };
}

/** Agrupa ingresos y gastos por mes, devolviendo todos los meses del rango aunque estén vacíos. */
export function summarizeByMonth(
  months: Month[],
  income: IncomeItem[],
  expenses: ExpenseItem[],
): Map<Month, MonthSummary> {
  const out = new Map<Month, MonthSummary>();
  for (const month of months) {
    out.set(month, {
      month,
      incomeCents: 0,
      paidCents: 0,
      unpaidCents: 0,
      sessions: 0,
      expensesCents: 0,
      resultCents: 0,
      byCategory: emptyCategories(),
    });
  }
  for (const item of income) {
    const s = out.get(monthOf(item.date));
    if (!s) continue;
    s.incomeCents += item.priceCents;
    s.sessions += 1;
    if (item.paid) s.paidCents += item.priceCents;
    else s.unpaidCents += item.priceCents;
  }
  for (const item of expenses) {
    const s = out.get(monthOf(item.date));
    if (!s) continue;
    s.expensesCents += item.amountCents;
    s.byCategory[item.category] += item.amountCents;
  }
  for (const s of out.values()) s.resultCents = s.incomeCents - s.expensesCents;
  return out;
}

/** Los `count` meses que terminan en `last`, del más viejo al más nuevo. */
export function monthsEndingAt(last: Month, count: number): Month[] {
  return Array.from({ length: count }, (_, i) => addMonths(last, i - count + 1));
}

export interface CapProgress {
  totalCents: number;
  capCents: number;
  /** Entre 0 y 1 o más si se pasó. */
  ratio: number;
  level: "ok" | "cerca" | "excedido";
}

/** Avance de los ingresos de los últimos 12 meses contra el tope de la categoría. */
export function capProgress(totalCents: number, capCents: number | null): CapProgress | null {
  if (!capCents || capCents <= 0) return null;
  const ratio = totalCents / capCents;
  return { totalCents, capCents, ratio, level: ratio > 1 ? "excedido" : ratio >= 0.8 ? "cerca" : "ok" };
}
