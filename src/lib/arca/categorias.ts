/**
 * Límites anuales de ingresos brutos por categoría de monotributo.
 *
 * ARCA los actualiza dos veces por año. Los carga y valida Norby, contador del proyecto,
 * en cada actualización; mientras esté vacío, el panel muestra la categoría y lo facturado pero
 * no el porcentaje del límite.
 */
export interface CategoryTable {
  /** Desde cuándo rige la tabla (YYYY-MM-DD). */
  validFrom: string;
  /** Límite anual en centavos por letra de categoría. */
  limitsCents: Partial<Record<string, number>>;
}

export const MONOTRIBUTO_CATEGORIES: CategoryTable[] = [];

/** La tabla vigente para una fecha: la más reciente que ya empezó a regir. */
export function categoryTableFor(date: string, tables = MONOTRIBUTO_CATEGORIES): CategoryTable | null {
  return (
    tables
      .filter((t) => t.validFrom <= date)
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null
  );
}

export function categoryLimitCents(category: string | null, date: string, tables = MONOTRIBUTO_CATEGORIES) {
  if (!category) return null;
  return categoryTableFor(date, tables)?.limitsCents[category.toUpperCase()] ?? null;
}
