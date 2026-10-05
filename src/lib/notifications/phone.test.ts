import { describe, expect, it } from "vitest";
import { toWhatsappNumber } from "./phone";

describe("toWhatsappNumber", () => {
  it.each([
    ["11 4444-3333", "5491144443333"],
    ["011 4444 3333", "5491144443333"],
    ["11 15 4444-3333", "5491144443333"],
    ["+54 9 11 4444 3333", "5491144443333"],
    ["+54 11 4444 3333", "5491144443333"],
    ["0351 15 555 1234", "5493515551234"],
    ["2944 15 12 3456", "5492944123456"],
    ["9 11 4444 3333", "5491144443333"],
  ])("%s → %s", (input, expected) => {
    expect(toWhatsappNumber(input)).toBe(expected);
  });

  it("rechaza números que no son celulares argentinos completos", () => {
    expect(toWhatsappNumber("4444-3333")).toBeNull();
    expect(toWhatsappNumber("")).toBeNull();
    expect(toWhatsappNumber(null)).toBeNull();
  });
});
