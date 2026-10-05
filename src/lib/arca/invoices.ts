import { and, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ArcaConnection, Invoice } from "@/db/schema";
import { toLocalDate } from "@/lib/agenda/slots";
import { createArcaClient } from "./client";
import { DOC_TYPE, VAT_CONDITION, VOUCHER_TYPE } from "./config";
import { normalizeCuit } from "./cuit";
import { ArcaError } from "./soap";

const TZ = "America/Argentina/Buenos_Aires";

export class InvoiceError extends Error {}

export interface Recipient {
  docType: number;
  docNumber: string;
  vatCondition: number;
  name: string;
  email: string | null;
}

/** Valida y normaliza los datos del receptor que carga el profesional. */
export function normalizeRecipient(input: {
  docType: number;
  docNumber?: string;
  vatCondition?: number;
  name: string;
  email: string | null;
}): Recipient {
  const digits = (input.docNumber ?? "").replace(/\D/g, "");
  if (input.docType === DOC_TYPE.sinIdentificar) {
    return { docType: DOC_TYPE.sinIdentificar, docNumber: "0", vatCondition: VAT_CONDITION.consumidorFinal, name: input.name, email: input.email };
  }
  if (input.docType === DOC_TYPE.dni) {
    if (!/^\d{7,8}$/.test(digits)) throw new InvoiceError("El DNI tiene que tener 7 u 8 números");
    return { docType: DOC_TYPE.dni, docNumber: digits, vatCondition: VAT_CONDITION.consumidorFinal, name: input.name, email: input.email };
  }
  if (input.docType === DOC_TYPE.cuit) {
    const cuit = normalizeCuit(digits);
    if (cuit.length !== 11) throw new InvoiceError("El CUIT tiene que tener 11 números");
    const vat = input.vatCondition ?? VAT_CONDITION.consumidorFinal;
    if (!(Object.values(VAT_CONDITION) as number[]).includes(vat)) throw new InvoiceError("Elegí la condición frente al IVA");
    return { docType: DOC_TYPE.cuit, docNumber: cuit, vatCondition: vat, name: input.name, email: input.email };
  }
  throw new InvoiceError("Tipo de documento no válido");
}

async function connectionFor(professionalId: string): Promise<ArcaConnection> {
  const [connection] = await db
    .select()
    .from(schema.arcaConnections)
    .where(eq(schema.arcaConnections.professionalId, professionalId));
  if (!connection?.verifiedAt || !connection.certificatePem) {
    throw new InvoiceError("Primero conectá tu facturación con ARCA");
  }
  return connection;
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

/** Crea la factura C de un turno realizado y pide el CAE. */
export async function invoiceBooking(professionalId: string, bookingId: string, recipient: Recipient) {
  const connection = await connectionFor(professionalId);
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.id, bookingId), eq(schema.bookings.professionalId, professionalId)));
  if (!booking) throw new InvoiceError("No encontramos ese turno");
  if (booking.status !== "realizado") throw new InvoiceError("Solo se facturan turnos realizados");

  const serviceDate = toLocalDate(booking.startsAt, TZ);
  const today = toLocalDate(new Date(), TZ);
  let invoice: Invoice;
  try {
    [invoice] = await db
      .insert(schema.invoices)
      .values({
        professionalId,
        bookingId,
        environment: connection.environment,
        type: "factura_c",
        cuit: connection.cuit,
        pointOfSale: connection.pointOfSale,
        issueDate: today,
        serviceFrom: serviceDate,
        serviceTo: serviceDate,
        // ARCA no acepta un vencimiento anterior a la fecha del comprobante.
        paymentDueDate: today,
        description: booking.serviceName,
        amountCents: booking.priceCents,
        recipientDocType: recipient.docType,
        recipientDocNumber: recipient.docNumber,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        recipientVatCondition: recipient.vatCondition,
      })
      .returning();
  } catch (error) {
    if (isUniqueViolation(error)) throw new InvoiceError("Ese turno ya tiene una factura");
    throw error;
  }
  return processInvoice(invoice.id);
}

/** Crea la nota de crédito C que anula por completo una factura emitida. */
export async function creditInvoice(professionalId: string, invoiceId: string) {
  const connection = await connectionFor(professionalId);
  const [original] = await db
    .select()
    .from(schema.invoices)
    .where(and(eq(schema.invoices.id, invoiceId), eq(schema.invoices.professionalId, professionalId)));
  if (!original || original.type !== "factura_c") throw new InvoiceError("No encontramos esa factura");
  if (original.status !== "emitida") throw new InvoiceError("Solo se anula una factura emitida");
  if (original.environment !== connection.environment || original.pointOfSale !== connection.pointOfSale) {
    throw new InvoiceError("Esa factura se emitió con otra conexión de ARCA");
  }

  const [pendingCredit] = await db
    .select({ id: schema.invoices.id })
    .from(schema.invoices)
    .where(and(eq(schema.invoices.creditsInvoiceId, invoiceId), eq(schema.invoices.status, "emitiendo")));
  if (pendingCredit) return processInvoice(pendingCredit.id);

  const today = toLocalDate(new Date(), TZ);
  const [credit] = await db
    .insert(schema.invoices)
    .values({
      professionalId,
      bookingId: original.bookingId,
      creditsInvoiceId: original.id,
      environment: original.environment,
      type: "nota_credito_c",
      cuit: original.cuit,
      pointOfSale: original.pointOfSale,
      issueDate: today,
      serviceFrom: original.serviceFrom,
      serviceTo: original.serviceTo,
      paymentDueDate: today,
      description: original.description,
      amountCents: original.amountCents,
      recipientDocType: original.recipientDocType,
      recipientDocNumber: original.recipientDocNumber,
      recipientName: original.recipientName,
      recipientEmail: original.recipientEmail,
      recipientVatCondition: original.recipientVatCondition,
    })
    .returning();
  return processInvoice(credit.id);
}

export type ProcessResult =
  | { status: "emitida"; invoice: Invoice }
  | { status: "rechazada"; invoice: Invoice; message: string }
  | { status: "pendiente"; invoice: Invoice; message: string };

/**
 * Pide el CAE de un comprobante en estado "emitiendo". Se hace de a uno por punto de venta y tipo,
 * con un lock de Postgres, para no saltear ni repetir números. Si ya tiene número asignado (un
 * intento anterior que se cortó), primero pregunta a ARCA si ese número quedó autorizado.
 */
export async function processInvoice(invoiceId: string): Promise<ProcessResult> {
  return db.transaction(async (tx) => {
    const [peek] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId));
    if (!peek) throw new InvoiceError("No encontramos el comprobante");
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${peek.environment}:${peek.cuit}:${peek.pointOfSale}:${peek.type}`}))`);

    const [invoice] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, invoiceId)).for("update");
    if (invoice.status === "emitida" || invoice.status === "anulada") return { status: "emitida", invoice };
    if (invoice.status === "rechazada") return { status: "rechazada", invoice, message: invoice.arcaMessages ?? "" };

    const [connection] = await tx
      .select()
      .from(schema.arcaConnections)
      .where(eq(schema.arcaConnections.professionalId, invoice.professionalId));
    if (!connection) throw new InvoiceError("Primero conectá tu facturación con ARCA");
    const client = createArcaClient(connection);
    const voucherType = VOUCHER_TYPE[invoice.type];

    const markIssued = async (cae: string, caeExpiresAt: string, number: number, extra: Partial<Invoice> = {}) => {
      const [updated] = await tx
        .update(schema.invoices)
        .set({ status: "emitida", cae, caeExpiresAt, number, ...extra })
        .where(eq(schema.invoices.id, invoice.id))
        .returning();
      if (invoice.creditsInvoiceId) {
        await tx.update(schema.invoices).set({ status: "anulada" }).where(eq(schema.invoices.id, invoice.creditsInvoiceId));
      }
      return { status: "emitida" as const, invoice: updated };
    };

    try {
      if (invoice.number) {
        const existing = await client.query(voucherType, invoice.number);
        if (existing && existing.amountCents === invoice.amountCents) {
          return await markIssued(existing.cae, existing.caeExpiresAt, invoice.number, { arcaMessages: null });
        }
      }

      const number = (await client.lastAuthorized(voucherType)) + 1;
      // Si otro intento cortado tenía este número, ARCA acaba de confirmar que no lo autorizó:
      // se lo saca para que tome uno nuevo cuando se reintente.
      await tx
        .update(schema.invoices)
        .set({ number: null })
        .where(
          and(
            ne(schema.invoices.id, invoice.id),
            eq(schema.invoices.status, "emitiendo"),
            eq(schema.invoices.environment, invoice.environment),
            eq(schema.invoices.cuit, invoice.cuit),
            eq(schema.invoices.pointOfSale, invoice.pointOfSale),
            eq(schema.invoices.type, invoice.type),
            eq(schema.invoices.number, number),
          ),
        );
      // El número queda guardado antes de pedir el CAE: si la respuesta se pierde, el reintento lo consulta.
      await tx.update(schema.invoices).set({ number }).where(eq(schema.invoices.id, invoice.id));

      let associated;
      if (invoice.creditsInvoiceId) {
        const [original] = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, invoice.creditsInvoiceId));
        associated = {
          voucherType: VOUCHER_TYPE.factura_c,
          pointOfSale: original.pointOfSale,
          number: original.number!,
          cuit: original.cuit,
          issueDate: original.issueDate,
        };
      }

      const { result, log } = await client.requestCae({
        pointOfSale: invoice.pointOfSale,
        voucherType,
        number,
        issueDate: invoice.issueDate,
        serviceFrom: invoice.serviceFrom,
        serviceTo: invoice.serviceTo,
        paymentDueDate: invoice.paymentDueDate,
        amountCents: invoice.amountCents,
        docType: invoice.recipientDocType,
        docNumber: invoice.recipientDocNumber,
        vatCondition: invoice.recipientVatCondition,
        associated,
      });

      const notes = result.observations.map((o) => `${o.code}: ${o.msg}`);
      if (result.approved) {
        return await markIssued(result.cae, result.caeExpiresAt, number, {
          arcaMessages: notes.join(" | ") || null,
          arcaLog: log,
        });
      }
      const message = [...result.errors.map((e) => `${e.code}: ${e.msg}`), ...notes].join(" | ") || "ARCA rechazó el comprobante";
      const [updated] = await tx
        .update(schema.invoices)
        .set({ status: "rechazada", arcaMessages: message, arcaLog: log })
        .where(eq(schema.invoices.id, invoice.id))
        .returning();
      return { status: "rechazada" as const, invoice: updated, message };
    } catch (error) {
      if (!(error instanceof ArcaError)) throw error;
      // Queda "emitiendo" con lo que se sepa; la transacción se confirma igual para no perder el número.
      const [updated] = await tx
        .update(schema.invoices)
        .set({ arcaMessages: error.message.slice(0, 1000) })
        .where(eq(schema.invoices.id, invoice.id))
        .returning();
      return { status: "pendiente" as const, invoice: updated, message: error.message };
    }
  });
}
