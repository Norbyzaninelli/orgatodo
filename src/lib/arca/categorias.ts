/**
 * Límites anuales de ingresos brutos por categoría de monotributo (Ley 24.977, anexo, art. 8).
 *
 * ARCA los actualiza dos veces por año (febrero y agosto) por la variación del IPC del semestre
 * anterior y los publica en https://www.arca.gob.ar/monotributo/categorias.asp.
 * Cada tabla nueva se agrega acá sin borrar las anteriores, así los meses viejos del resumen
 * se comparan contra el límite que regía en ese momento. Las valida Norby, contador del proyecto.
 */
export interface CategoryTable {
  /** Desde cuándo rige la tabla (YYYY-MM-DD). */
  validFrom: string;
  /** Límite anual en centavos por letra de categoría. */
  limitsCents: Partial<Record<string, number>>;
}

export const MONOTRIBUTO_CATEGORIES: CategoryTable[] = [
  {
    // Vigente desde el 1/2/2026: ajuste de 14,29% por IPC del segundo semestre de 2025.
    validFrom: "2026-02-01",
    limitsCents: {
      A: 1_027_798_813,
      B: 1_505_844_771,
      C: 2_111_369_652,
      D: 2_621_285_342,
      E: 3_083_396_437,
      F: 3_864_204_836,
      G: 4_621_110_937,
      H: 7_011_340_733,
      I: 7_847_921_162,
      J: 8_987_264_030,
      K: 10_835_708_405,
    },
  },
  {
    // Vigente desde el 1/8/2026: ajuste de 16,85% por IPC del primer semestre de 2026.
    validFrom: "2026-08-01",
    limitsCents: {
      A: 1_200_941_045,
      B: 1_759_518_274,
      C: 2_467_049_431,
      D: 3_062_865_143,
      E: 3_602_823_133,
      F: 4_515_165_941,
      G: 5_399_579_887,
      H: 8_192_466_037,
      I: 9_169_976_190,
      J: 10_501_251_920,
      K: 12_661_083_875,
    },
  },
];

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
