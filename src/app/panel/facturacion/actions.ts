"use server";

import { after } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireProfessional } from "@/lib/auth";
import {
  ConnectionError,
  getConnection,
  refreshCategory,
  saveCertificate,
  startConnection,
  issueTestCertificate,
  verifyConnection,
} from "@/lib/arca/connection";
import { emailInvoice } from "@/lib/arca/email";
import { creditInvoice, InvoiceError, invoiceBooking, normalizeRecipient, processInvoice, type ProcessResult } from "@/lib/arca/invoices";
import { INVOICE_TYPE_LABEL } from "@/lib/arca/qr";
import type { FormState } from "@/lib/form-state";

function refresh() {
  revalidatePath("/panel/facturacion");
  revalidatePath("/panel/resumen");
}

async function guard(run: () => Promise<FormState>): Promise<FormState> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ConnectionError || error instanceof InvoiceError) return { error: error.message };
    throw error;
  } finally {
    refresh();
  }
}

// --- Conexión ----------------------------------------------------------------

const startSchema = z.object({
  cuit: z.string().trim().min(1, "Ingresá tu CUIT"),
  pointOfSale: z.coerce.number("Ingresá el número de punto de venta").int(),
});

export async function startConnectionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pro = await requireProfessional();
  const parsed = startSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return guard(async () => {
    await startConnection(pro, parsed.data);
    return { ok: "Listo. Ahora descargá el pedido de certificado." };
  });
}

export async function uploadCertificateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pro = await requireProfessional();
  const file = formData.get("certificate");
  let pem = String(formData.get("certificateText") ?? "").trim();
  if (!pem && file instanceof File && file.size > 0) {
    if (file.size > 20_000) return { error: "Ese archivo es demasiado grande para ser un certificado" };
    pem = (await file.text()).trim();
  }
  if (!pem) return { error: "Elegí el archivo del certificado o pegá su contenido" };
  return guard(async () => {
    const result = await saveCertificate(pro.id, pem);
    return result.ok ? { ok: "Conexión con ARCA verificada" } : { error: result.error };
  });
}

export async function applyTestCertificateAction(): Promise<FormState> {
  const pro = await requireProfessional();
  return guard(async () => {
    const result = await issueTestCertificate(pro.id);
    return result.ok ? { ok: "Conexión simulada lista" } : { error: result.error };
  });
}

export async function verifyConnectionAction(): Promise<FormState> {
  const pro = await requireProfessional();
  return guard(async () => {
    const result = await verifyConnection(pro.id);
    return result.ok ? { ok: "La conexión funciona" } : { error: result.error };
  });
}

export async function refreshCategoryAction(): Promise<FormState> {
  const pro = await requireProfessional();
  return guard(async () => {
    const result = await refreshCategory(pro.id);
    return result.ok ? { ok: "Categoría actualizada" } : { error: result.error };
  });
}

const legendsSchema = z.object({
  grossIncomeNumber: z.string().trim().max(40).optional(),
  activityStartDate: z.iso.date().optional().or(z.literal("")),
});

export async function saveLegendsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pro = await requireProfessional();
  const parsed = legendsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Revisá la fecha de inicio de actividades" };
  await db
    .update(schema.arcaConnections)
    .set({
      grossIncomeNumber: parsed.data.grossIncomeNumber || null,
      activityStartDate: parsed.data.activityStartDate || null,
    })
    .where(eq(schema.arcaConnections.professionalId, pro.id));
  refresh();
  return { ok: "Datos guardados" };
}

// --- Comprobantes --------------------------------------------------------------

/** Si salió bien, vuelve a la página con un aviso arriba: el formulario del turno desaparece de la lista. */
function describeResult(result: ProcessResult): FormState {
  const label = INVOICE_TYPE_LABEL[result.invoice.type];
  if (result.status === "emitida") {
    refresh();
    redirect(`/panel/facturacion?emitido=${result.invoice.id}`);
  }
  if (result.status === "rechazada") return { error: `ARCA rechazó la ${label.toLowerCase()}: ${result.message}` };
  return { error: `La ${label.toLowerCase()} quedó pendiente: ${result.message}. Podés reintentar desde la lista.` };
}

function sendAfter(result: ProcessResult, professionalName: string) {
  if (result.status === "emitida") after(() => emailInvoice(result.invoice, professionalName));
}

const invoiceSchema = z.object({
  bookingId: z.uuid(),
  docType: z.coerce.number().int(),
  docNumber: z.string().optional(),
  vatCondition: z.coerce.number().int().optional(),
  sendEmail: z.string().optional(),
});

export async function invoiceBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pro = await requireProfessional();
  const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Revisá los datos del comprobante" };
  return guard(async () => {
    const [row] = await db
      .select({ name: schema.clients.name, email: schema.clients.email })
      .from(schema.bookings)
      .innerJoin(schema.clients, eq(schema.bookings.clientId, schema.clients.id))
      .where(eq(schema.bookings.id, parsed.data.bookingId));
    if (!row) return { error: "No encontramos ese turno" };
    const recipient = normalizeRecipient({
      docType: parsed.data.docType,
      docNumber: parsed.data.docNumber,
      vatCondition: parsed.data.vatCondition,
      name: row.name,
      email: parsed.data.sendEmail === "on" ? row.email : null,
    });
    const result = await invoiceBooking(pro.id, parsed.data.bookingId, recipient);
    sendAfter(result, pro.displayName);
    return describeResult(result);
  });
}

export async function creditInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pro = await requireProfessional();
  const id = z.uuid().parse(formData.get("invoiceId"));
  return guard(async () => {
    const result = await creditInvoice(pro.id, id);
    sendAfter(result, pro.displayName);
    return describeResult(result);
  });
}

export async function retryInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pro = await requireProfessional();
  const id = z.uuid().parse(formData.get("invoiceId"));
  return guard(async () => {
    const [invoice] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id));
    if (!invoice || invoice.professionalId !== pro.id) return { error: "No encontramos ese comprobante" };
    if (!(await getConnection(pro.id))?.verifiedAt) return { error: "Primero verificá tu conexión con ARCA" };
    const result = await processInvoice(id);
    sendAfter(result, pro.displayName);
    return describeResult(result);
  });
}
