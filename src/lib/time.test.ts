import { describe, expect, it } from "vitest";
import { centsToInput, minutesToTime, parsePriceToCents, timeToMinutes } from "./time";

describe("horas", () => {
  it("convierte en ambos sentidos", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("24:00")).toBe(1440);
    expect(minutesToTime(570)).toBe("09:30");
  });

  it("rechaza horas inválidas", () => {
    expect(timeToMinutes("25:00")).toBeNull();
    expect(timeToMinutes("9")).toBeNull();
  });
});

describe("precios", () => {
  it("acepta el formato argentino", () => {
    expect(parsePriceToCents("25.000")).toBe(2_500_000);
    expect(parsePriceToCents("$ 25.000,50")).toBe(2_500_050);
    expect(parsePriceToCents("18000")).toBe(1_800_000);
  });

  it("rechaza texto que no es un precio", () => {
    expect(parsePriceToCents("abc")).toBeNull();
    expect(parsePriceToCents("")).toBeNull();
  });

  it("muestra los centavos solo si hay", () => {
    expect(centsToInput(2_500_000)).toBe("25000");
    expect(centsToInput(2_500_050)).toBe("25000,50");
  });
});
