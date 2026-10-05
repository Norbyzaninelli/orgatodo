/**
 * Convierte un teléfono argentino escrito como lo carga la gente al formato que pide WhatsApp:
 * 54 + 9 + código de área sin 0 + número sin 15. Ejemplos: "11 15 4444-3333", "011 4444 3333",
 * "+54 9 11 4444 3333" → "5491144443333". Devuelve null si no parece un celular argentino.
 */
export function toWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("54")) digits = digits.slice(2);
  if (digits.startsWith("9") && digits.length === 11) digits = digits.slice(1);
  if (digits.startsWith("0")) digits = digits.slice(1);

  // Código de área (2 a 4 dígitos) + "15" + número local: el total sin el 15 es de 10 dígitos.
  if (digits.length === 12) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === "15") {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        break;
      }
    }
  }

  if (digits.length !== 10) return null;
  return `549${digits}`;
}
