import { describe, expect, it } from "vitest";
import {
  addMonths,
  capProgress,
  isValidMonth,
  monthBounds,
  monthsEndingAt,
  summarizeByMonth,
} from "./resumen";

describe("meses", () => {
  it("suma y resta meses cruzando el año", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", -11)).toBe("2025-11");
  });

  it("valida el formato", () => {
    expect(isValidMonth("2026-10")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-1")).toBe(false);
    expect(isValidMonth(undefined)).toBe(false);
  });

  it("da los límites del mes", () => {
    expect(monthBounds("2026-12")).toEqual({ first: "2026-12-01", next: "2027-01-01" });
  });

  it("arma los últimos meses en orden", () => {
    expect(monthsEndingAt("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});

describe("summarizeByMonth", () => {
  it("separa cobrado de pendiente y resta los gastos", () => {
    const result = summarizeByMonth(
      ["2026-09", "2026-10"],
      [
        { date: "2026-10-01", priceCents: 1000000, paid: true },
        { date: "2026-10-20", priceCents: 500000, paid: false },
        { date: "2026-09-30", priceCents: 200000, paid: true },
        { date: "2026-08-15", priceCents: 999900, paid: true },
      ],
      [
        { date: "2026-10-05", category: "alquiler", amountCents: 300000 },
        { date: "2026-10-06", category: "insumos", amountCents: 50000 },
      ],
    );
    expect(result.get("2026-10")).toMatchObject({
      incomeCents: 1500000,
      paidCents: 1000000,
      unpaidCents: 500000,
      sessions: 2,
      expensesCents: 350000,
      resultCents: 1150000,
      byCategory: { alquiler: 300000, insumos: 50000, monotributo: 0, otros: 0 },
    });
    expect(result.get("2026-09")?.incomeCents).toBe(200000);
    expect(result.has("2026-08")).toBe(false);
  });
});

describe("capProgress", () => {
  it("sin tope no muestra nada", () => {
    expect(capProgress(100, null)).toBeNull();
    expect(capProgress(100, 0)).toBeNull();
  });

  it("avisa cerca del tope y al pasarse", () => {
    expect(capProgress(50, 100)?.level).toBe("ok");
    expect(capProgress(80, 100)?.level).toBe("cerca");
    expect(capProgress(101, 100)?.level).toBe("excedido");
  });
});
