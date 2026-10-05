import type { Invoice } from "@/db/schema";
import { VOUCHER_TYPE } from "./config";

/** Link del código QR obligatorio en los comprobantes electrónicos (RG 4291). */
export function invoiceQrUrl(invoice: Invoice): string | null {
  if (!invoice.cae || !invoice.number) return null;
  const data = {
    ver: 1,
    fecha: invoice.issueDate,
    cuit: Number(invoice.cuit),
    ptoVta: invoice.pointOfSale,
    tipoCmp: VOUCHER_TYPE[invoice.type],
    nroCmp: invoice.number,
    importe: invoice.amountCents / 100,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: invoice.recipientDocType,
    nroDocRec: Number(invoice.recipientDocNumber),
    tipoCodAut: "E",
    codAut: Number(invoice.cae),
  };
  return `https://www.afip.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(data)).toString("base64")}`;
}

/** 00001-00000042 */
export function voucherNumber(invoice: Pick<Invoice, "pointOfSale" | "number">): string {
  return `${String(invoice.pointOfSale).padStart(5, "0")}-${String(invoice.number ?? 0).padStart(8, "0")}`;
}

export const INVOICE_TYPE_LABEL = { factura_c: "Factura C", nota_credito_c: "Nota de crédito C" } as const;

/**
 * Facturado neto en un período: facturas emitidas (incluidas las que después se anularon) menos
 * notas de crédito emitidas. Así una factura anulada no suma.
 */
export function netInvoicedCents(rows: Pick<Invoice, "type" | "status" | "amountCents">[]): number {
  return rows.reduce((sum, r) => {
    if (r.type === "factura_c" && (r.status === "emitida" || r.status === "anulada")) return sum + r.amountCents;
    if (r.type === "nota_credito_c" && r.status === "emitida") return sum - r.amountCents;
    return sum;
  }, 0);
}
