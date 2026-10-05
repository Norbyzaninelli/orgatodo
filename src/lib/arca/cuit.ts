/** Deja solo los dígitos de un CUIT o CUIL. */
export function normalizeCuit(value: string): string {
  return value.replace(/\D/g, "");
}

/** Valida el dígito verificador de un CUIT/CUIL de 11 dígitos. */
export function isValidCuit(value: string): boolean {
  const cuit = normalizeCuit(value);
  if (!/^\d{11}$/.test(cuit)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(cuit[i]), 0);
  const mod = 11 - (sum % 11);
  const check = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  return check === Number(cuit[10]);
}

/** 20123456786 → 20-12345678-6 */
export function formatCuit(value: string): string {
  const cuit = normalizeCuit(value);
  return cuit.length === 11 ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}` : value;
}
