import { describe, expect, it } from "vitest";
import { formatCuit, isValidCuit } from "./cuit";

describe("CUIT", () => {
  it("valida el dígito verificador", () => {
    expect(isValidCuit("20-12345678-6")).toBe(true);
    expect(isValidCuit("20123456786")).toBe(true);
    expect(isValidCuit("20123456787")).toBe(false);
    expect(isValidCuit("30-71234567-1")).toBe(true);
    expect(isValidCuit("2012345678")).toBe(false);
  });

  it("da formato con guiones", () => {
    expect(formatCuit("20123456786")).toBe("20-12345678-6");
  });
});
