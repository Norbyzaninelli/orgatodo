import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ArcaConnection, Professional } from "@/db/schema";
import { createArcaClient } from "./client";
import { arcaMode } from "./config";
import { CertificateError, decrypt, encrypt, generateKeyAndCsr, inspectCertificate, selfSignForTesting } from "./crypto";
import { isValidCuit, normalizeCuit } from "./cuit";
import { ArcaError } from "./soap";

export class ConnectionError extends Error {}

export async function getConnection(professionalId: string): Promise<ArcaConnection | null> {
  const [row] = await db
    .select()
    .from(schema.arcaConnections)
    .where(eq(schema.arcaConnections.professionalId, professionalId));
  return row ?? null;
}

/**
 * Paso 1: CUIT y punto de venta. Genera una clave nueva y su pedido de certificado; si ya había
 * una conexión, la reemplaza (el certificado anterior deja de servir).
 */
export async function startConnection(pro: Professional, input: { cuit: string; pointOfSale: number }) {
  const cuit = normalizeCuit(input.cuit);
  if (!isValidCuit(cuit)) throw new ConnectionError("Revisá el CUIT: el dígito verificador no coincide");
  if (!Number.isInteger(input.pointOfSale) || input.pointOfSale < 1 || input.pointOfSale > 99998) {
    throw new ConnectionError("El punto de venta es un número entre 1 y 99998");
  }

  const { privateKeyPem, csrPem } = generateKeyAndCsr({ cuit, name: pro.displayName });
  const values = {
    environment: arcaMode(),
    cuit,
    pointOfSale: input.pointOfSale,
    privateKeyEncrypted: encrypt(privateKeyPem),
    csrPem,
    certificatePem: null,
    certificateExpiresAt: null,
    verifiedAt: null,
    lastError: null,
    monotributoCategory: null,
    monotributoCategoryDescription: null,
    categoryCheckedAt: null,
  };
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: schema.arcaConnections.id })
      .from(schema.arcaConnections)
      .where(eq(schema.arcaConnections.professionalId, pro.id));
    if (existing) {
      await tx.delete(schema.arcaTickets).where(eq(schema.arcaTickets.connectionId, existing.id));
      await tx.update(schema.arcaConnections).set(values).where(eq(schema.arcaConnections.id, existing.id));
    } else {
      await tx.insert(schema.arcaConnections).values({ ...values, professionalId: pro.id });
    }
    await tx.update(schema.professionals).set({ cuit }).where(eq(schema.professionals.id, pro.id));
  });
}

/** Paso 2: el certificado que devolvió ARCA. Se valida contra la clave y se prueba la conexión. */
export async function saveCertificate(professionalId: string, certificatePem: string) {
  const connection = await getConnection(professionalId);
  if (!connection) throw new ConnectionError("Primero cargá tu CUIT y punto de venta");

  let info;
  try {
    info = inspectCertificate(certificatePem, decrypt(connection.privateKeyEncrypted));
  } catch (error) {
    if (error instanceof CertificateError) throw new ConnectionError(error.message);
    throw error;
  }
  if (info.cuit && info.cuit !== connection.cuit) {
    throw new ConnectionError(`El certificado es del CUIT ${info.cuit}, pero la conexión es para ${connection.cuit}`);
  }
  if (info.expiresAt <= new Date()) throw new ConnectionError("Ese certificado ya venció. Generá uno nuevo en ARCA.");

  await db.delete(schema.arcaTickets).where(eq(schema.arcaTickets.connectionId, connection.id));
  await db
    .update(schema.arcaConnections)
    .set({ certificatePem: certificatePem.trim(), certificateExpiresAt: info.expiresAt, verifiedAt: null })
    .where(eq(schema.arcaConnections.id, connection.id));
  return verifyConnection(professionalId);
}

/** Solo en modo simulado: firma el pedido como si fuera ARCA, para probar sin trámites. */
export async function issueTestCertificate(professionalId: string) {
  const connection = await getConnection(professionalId);
  if (!connection) throw new ConnectionError("Primero cargá tu CUIT y punto de venta");
  if (connection.environment !== "simulado") throw new ConnectionError("El certificado de prueba solo sirve en modo simulado");
  return saveCertificate(professionalId, selfSignForTesting(connection.csrPem, decrypt(connection.privateKeyEncrypted)));
}

/**
 * Prueba la conexión: consulta el último comprobante del punto de venta y la constancia de
 * inscripción, de donde sale la categoría de monotributo.
 */
export async function verifyConnection(professionalId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const connection = await getConnection(professionalId);
  if (!connection?.certificatePem) return { ok: false, error: "Falta subir el certificado" };
  const client = createArcaClient(connection);
  try {
    await client.lastAuthorized(11);
  } catch (error) {
    const message = describe(error, "facturación electrónica (wsfe)");
    await db.update(schema.arcaConnections).set({ lastError: message, verifiedAt: null }).where(eq(schema.arcaConnections.id, connection.id));
    return { ok: false, error: message };
  }
  await db
    .update(schema.arcaConnections)
    .set({ verifiedAt: new Date(), lastError: null })
    .where(eq(schema.arcaConnections.id, connection.id));
  // La constancia no frena la facturación: si falla, queda el aviso para reintentar.
  await refreshCategory(professionalId);
  return { ok: true };
}

export async function refreshCategory(professionalId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const connection = await getConnection(professionalId);
  if (!connection?.certificatePem) return { ok: false, error: "Falta subir el certificado" };
  try {
    const taxpayer = await createArcaClient(connection).taxpayer();
    await db
      .update(schema.arcaConnections)
      .set({
        legalName: taxpayer.legalName,
        fiscalAddress: taxpayer.fiscalAddress,
        monotributoCategory: taxpayer.category,
        monotributoCategoryDescription: taxpayer.categoryDescription,
        categoryCheckedAt: new Date(),
        lastError: taxpayer.category ? null : "ARCA no informa una categoría de monotributo para este CUIT",
      })
      .where(eq(schema.arcaConnections.id, connection.id));
    return { ok: true };
  } catch (error) {
    const message = describe(error, "constancia de inscripción (ws_sr_constancia_inscripcion)");
    await db.update(schema.arcaConnections).set({ lastError: message }).where(eq(schema.arcaConnections.id, connection.id));
    return { ok: false, error: message };
  }
}

/** Traduce los errores más comunes de ARCA a algo que el profesional pueda resolver. */
function describe(error: unknown, service: string): string {
  if (!(error instanceof ArcaError)) return `Error inesperado: ${(error as Error).message}`;
  const text = error.message.toLowerCase();
  if (text.includes("no autorizado") || text.includes("notauthorized") || error.code === "cms.cert.notAuthorized") {
    return `ARCA dice que el certificado no está autorizado para ${service}. Revisá en el Administrador de Relaciones que esté asociado a ese servicio.`;
  }
  if (text.includes("punto de venta") || error.code === "602") {
    return "ARCA no reconoce el punto de venta. Tiene que ser un punto de venta \"RECE para aplicativo y web services\".";
  }
  return `ARCA respondió: ${error.message}`;
}
