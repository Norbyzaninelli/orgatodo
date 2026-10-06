import { describe, expect, it } from "vitest";
import { MONOTRIBUTO_CATEGORIES, categoryLimitCents, categoryTableFor } from "./categorias";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];

describe("tabla de categorías del monotributo", () => {
  it("cada tabla tiene las 11 categorías en orden creciente", () => {
    for (const table of MONOTRIBUTO_CATEGORIES) {
      const limits = LETTERS.map((l) => table.limitsCents[l]);
      expect(limits.every((v) => Number.isInteger(v) && v! > 0)).toBe(true);
      for (let i = 1; i < limits.length; i++) expect(limits[i]!).toBeGreaterThan(limits[i - 1]!);
    }
  });

  it("usa la tabla que rige en la fecha", () => {
    expect(categoryTableFor("2026-01-31")).toBeNull();
    expect(categoryTableFor("2026-07-31")?.validFrom).toBe("2026-02-01");
    expect(categoryTableFor("2026-08-01")?.validFrom).toBe("2026-08-01");
    expect(categoryLimitCents("a", "2026-10-01")).toBe(1_200_941_045);
    expect(categoryLimitCents("K", "2026-03-15")).toBe(10_835_708_405);
    expect(categoryLimitCents(null, "2026-10-01")).toBeNull();
    expect(categoryLimitCents("Z", "2026-10-01")).toBeNull();
  });
});
