import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { PrintButton } from "@/components/print-button";
import { db, schema } from "@/db";
import { VAT_CONDITION_LABELS } from "@/lib/arca/config";
import { formatCuit } from "@/lib/arca/cuit";
import { invoiceQrUrl, voucherNumber } from "@/lib/arca/qr";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Comprobante", robots: { index: false } };

function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

const DOC_LABEL: Record<number, string> = { 80: "CUIT", 96: "DNI", 99: "" };

export default async function InvoicePage(props: PageProps<"/factura/[token]">) {
  const { token } = await props.params;
  const [row] = await db
    .select({ invoice: schema.invoices, connection: schema.arcaConnections, professional: schema.professionals })
    .from(schema.invoices)
    .innerJoin(schema.professionals, eq(schema.invoices.professionalId, schema.professionals.id))
    .leftJoin(schema.arcaConnections, eq(schema.arcaConnections.professionalId, schema.invoices.professionalId))
    .where(eq(schema.invoices.publicToken, token));
  if (!row || !row.invoice.cae || (row.invoice.status !== "emitida" && row.invoice.status !== "anulada")) notFound();
  const { invoice, connection, professional } = row;

  const isCredit = invoice.type === "nota_credito_c";
  let associated = null;
  if (invoice.creditsInvoiceId) {
    [associated] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, invoice.creditsInvoiceId));
  }
  const qrUrl = invoiceQrUrl(invoice);
  const qr = qrUrl ? await QRCode.toDataURL(qrUrl, { margin: 1, width: 160 }) : null;
  const simulated = invoice.environment !== "produccion";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted">Comprobante emitido por {professional.displayName} a través de ORGATODO.</p>
        <PrintButton />
      </div>

      <article className="space-y-5 rounded-xl border border-border bg-white p-6 text-sm text-zinc-900 print:border-0 print:p-0">
        {simulated && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-center font-semibold text-amber-800">
            {invoice.environment === "simulado" ? "Comprobante simulado" : "Comprobante de homologación"}: sin validez fiscal
          </p>
        )}
        <header className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 border-b border-zinc-300 pb-4">
          <div className="space-y-0.5">
            <p className="text-base font-bold">{connection?.legalName ?? professional.displayName}</p>
            {connection?.fiscalAddress && <p>{connection.fiscalAddress}</p>}
            <p>Responsable Monotributo</p>
          </div>
          <div className="flex flex-col items-center">
            <span className="flex h-12 w-12 items-center justify-center border-2 border-zinc-900 text-3xl font-bold">C</span>
            <span className="mt-1 text-[10px]">COD. {isCredit ? "13" : "11"}</span>
          </div>
          <div className="space-y-0.5 text-right">
            <p className="text-base font-bold">{isCredit ? "NOTA DE CRÉDITO" : "FACTURA"}</p>
            <p>N° {voucherNumber(invoice)}</p>
            <p>Fecha: {formatDate(invoice.issueDate)}</p>
            <p>CUIT: {formatCuit(invoice.cuit)}</p>
            {connection?.grossIncomeNumber && <p>Ingresos Brutos: {connection.grossIncomeNumber}</p>}
            {connection?.activityStartDate && <p>Inicio de actividades: {formatDate(connection.activityStartDate)}</p>}
          </div>
        </header>

        <section className="grid gap-1 border-b border-zinc-300 pb-4 sm:grid-cols-2">
          <p>
            <strong>Cliente:</strong> {invoice.recipientName}
          </p>
          <p>
            <strong>Condición frente al IVA:</strong> {VAT_CONDITION_LABELS[invoice.recipientVatCondition] ?? invoice.recipientVatCondition}
          </p>
          {invoice.recipientDocType !== 99 && (
            <p>
              <strong>{DOC_LABEL[invoice.recipientDocType]}:</strong>{" "}
              {invoice.recipientDocType === 80 ? formatCuit(invoice.recipientDocNumber) : invoice.recipientDocNumber}
            </p>
          )}
          <p>
            <strong>Período facturado:</strong> {formatDate(invoice.serviceFrom)} al {formatDate(invoice.serviceTo)}
          </p>
          <p>
            <strong>Vencimiento del pago:</strong> {formatDate(invoice.paymentDueDate)}
          </p>
          {associated?.number && (
            <p>
              <strong>Comprobante asociado:</strong> Factura C {voucherNumber(associated)} del {formatDate(associated.issueDate)}
            </p>
          )}
        </section>

        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-300 text-left">
              <th className="py-1 font-semibold">Descripción</th>
              <th className="py-1 text-right font-semibold">Cant.</th>
              <th className="py-1 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1">{invoice.description}</td>
              <td className="py-1 text-right">1</td>
              <td className="py-1 text-right">{formatPrice(invoice.amountCents)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-right text-lg font-bold">Total: {formatPrice(invoice.amountCents)}</p>

        <footer className="flex items-end justify-between gap-4 border-t border-zinc-300 pt-4">
          {qr && qrUrl && (
            <a href={qrUrl}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Código QR de ARCA" width={120} height={120} />
            </a>
          )}
          <div className="space-y-0.5 text-right">
            <p>
              <strong>CAE:</strong> {invoice.cae}
            </p>
            {invoice.caeExpiresAt && (
              <p>
                <strong>Vencimiento del CAE:</strong> {formatDate(invoice.caeExpiresAt)}
              </p>
            )}
            <p className="text-xs text-zinc-500">Comprobante autorizado por ARCA</p>
          </div>
        </footer>
        {invoice.status === "anulada" && (
          <p className="text-center font-semibold text-red-700">Esta factura fue anulada con una nota de crédito.</p>
        )}
      </article>
    </div>
  );
}
