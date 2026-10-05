import type { Invoice } from "@/db/schema";
import { formatPrice } from "@/lib/format";
import { appUrl } from "@/lib/notifications/process";
import { sendEmail } from "@/lib/notifications/providers";
import { textToHtml } from "@/lib/notifications/messages";
import { INVOICE_TYPE_LABEL, voucherNumber } from "./qr";

/** Manda al cliente el link a su comprobante. Un error queda en el log y no afecta la emisión. */
export async function emailInvoice(invoice: Invoice, professionalName: string) {
  if (!invoice.recipientEmail || invoice.status !== "emitida") return;
  // Un comprobante de prueba nunca le llega a un cliente real.
  if (invoice.environment !== "produccion") {
    console.info(`[facturacion:prueba] no se envía el comprobante ${invoice.id} (${invoice.environment}) a ${invoice.recipientEmail}`);
    return;
  }
  const label = INVOICE_TYPE_LABEL[invoice.type];
  const url = `${appUrl()}/factura/${invoice.publicToken}`;
  const text = [
    `Hola ${invoice.recipientName}, ${professionalName} te envía la ${label} ${voucherNumber(invoice)} por ${formatPrice(invoice.amountCents)} (${invoice.description}).`,
    `Podés verla, descargarla o imprimirla acá: ${url}`,
  ].join("\n\n");
  try {
    await sendEmail({
      to: invoice.recipientEmail,
      subject: `${label} de ${professionalName}`,
      text,
      html: textToHtml(text),
    });
  } catch (error) {
    console.error(`[facturacion] no se pudo mandar el comprobante ${invoice.id}`, error);
  }
}
