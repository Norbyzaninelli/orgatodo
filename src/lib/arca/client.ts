import { randomInt } from "node:crypto";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ArcaConnection } from "@/db/schema";
import { ENDPOINTS, SERVICES } from "./config";
import { decrypt, signCms } from "./crypto";
import { buildGetPersona, parseGetPersona, type Taxpayer } from "./padron";
import { ArcaError, soapRequest } from "./soap";
import { buildLoginRequest, buildTra, parseLoginResponse, type Ticket } from "./wsaa";
import {
  buildCaeRequest,
  buildLastAuthorized,
  buildQuery,
  parseCaeResponse,
  parseLastAuthorized,
  parseQuery,
  type CaeRequest,
  type CaeResult,
  type QueriedVoucher,
} from "./wsfe";

export interface ArcaClient {
  lastAuthorized(voucherType: number): Promise<number>;
  requestCae(request: CaeRequest): Promise<{ result: CaeResult; log: { request: string; response: string } }>;
  query(voucherType: number, number: number): Promise<QueriedVoucher | null>;
  taxpayer(): Promise<Taxpayer>;
}

export function createArcaClient(connection: ArcaConnection): ArcaClient {
  return connection.environment === "simulado" ? simulatedClient(connection) : realClient(connection);
}

// --- ARCA de verdad --------------------------------------------------------

/** Reusa el permiso guardado mientras le queden al menos 5 minutos; si no, pide uno nuevo a WSAA. */
async function getTicket(connection: ArcaConnection, service: string): Promise<Ticket> {
  const [cached] = await db
    .select()
    .from(schema.arcaTickets)
    .where(
      and(
        eq(schema.arcaTickets.connectionId, connection.id),
        eq(schema.arcaTickets.service, service),
        gt(schema.arcaTickets.expiresAt, new Date(Date.now() + 5 * 60_000)),
      ),
    );
  if (cached) return cached;

  if (!connection.certificatePem) throw new ArcaError("Falta subir el certificado");
  const env = connection.environment as "homologacion" | "produccion";
  const cms = signCms(buildTra(service), connection.certificatePem, decrypt(connection.privateKeyEncrypted));
  let ticket: Ticket;
  try {
    ticket = parseLoginResponse(await soapRequest(ENDPOINTS[env].wsaa, "", buildLoginRequest(cms)));
  } catch (error) {
    if (error instanceof ArcaError && error.code === "alreadyAuthenticated") {
      throw new ArcaError(
        "ARCA tiene un permiso vigente pedido desde otro sistema con este certificado. Probá de nuevo en unos minutos.",
        error.code,
        true,
      );
    }
    throw error;
  }
  await db
    .insert(schema.arcaTickets)
    .values({ connectionId: connection.id, service, ...ticket })
    .onConflictDoUpdate({
      target: [schema.arcaTickets.connectionId, schema.arcaTickets.service],
      set: { token: ticket.token, sign: ticket.sign, expiresAt: ticket.expiresAt },
    });
  return ticket;
}

function realClient(connection: ArcaConnection): ArcaClient {
  const env = connection.environment as "homologacion" | "produccion";
  const auth = async (service: string) => ({ ...(await getTicket(connection, service)), cuit: connection.cuit });
  const wsfe = async (req: { action: string; xml: string }) => soapRequest(ENDPOINTS[env].wsfe, req.action, req.xml);

  return {
    async lastAuthorized(voucherType) {
      const req = buildLastAuthorized(await auth(SERVICES.wsfe), connection.pointOfSale, voucherType);
      return parseLastAuthorized(await wsfe(req));
    },
    async requestCae(request) {
      const req = buildCaeRequest(await auth(SERVICES.wsfe), request);
      const response = await wsfe(req);
      return { result: parseCaeResponse(response), log: { request: redact(req.xml), response } };
    },
    async query(voucherType, number) {
      const req = buildQuery(await auth(SERVICES.wsfe), connection.pointOfSale, voucherType, number);
      return parseQuery(await wsfe(req));
    },
    async taxpayer() {
      const req = buildGetPersona(await auth(SERVICES.padron), connection.cuit);
      return parseGetPersona(await soapRequest(ENDPOINTS[env].padron, req.action, req.xml));
    },
  };
}

/** El log de auditoría no guarda el token ni la firma del permiso. */
function redact(xml: string): string {
  return xml.replace(/<ar:Token>.*?<\/ar:Token>/, "<ar:Token>…</ar:Token>").replace(/<ar:Sign>.*?<\/ar:Sign>/, "<ar:Sign>…</ar:Sign>");
}

// --- Simulado --------------------------------------------------------------

/**
 * Imita a ARCA sin salir a internet: numera según lo ya emitido en modo simulado y aprueba todo.
 * La categoría se puede elegir con ARCA_SIMULADO_CATEGORIA (por defecto C).
 */
function simulatedClient(connection: ArcaConnection): ArcaClient {
  const voucherTypeName = (code: number): "factura_c" | "nota_credito_c" => (code === 13 ? "nota_credito_c" : "factura_c");
  const issued = (voucherType: number) =>
    and(
      eq(schema.invoices.environment, "simulado"),
      eq(schema.invoices.cuit, connection.cuit),
      eq(schema.invoices.pointOfSale, connection.pointOfSale),
      eq(schema.invoices.type, voucherTypeName(voucherType)),
      inArray(schema.invoices.status, ["emitida", "anulada"]),
    );

  return {
    async lastAuthorized(voucherType) {
      const [row] = await db
        .select({ max: sql<number | null>`max(${schema.invoices.number})` })
        .from(schema.invoices)
        .where(issued(voucherType));
      return Number(row?.max ?? 0);
    },
    async requestCae(request) {
      const cae = String(randomInt(10 ** 13, 10 ** 14 - 1));
      const due = new Date(`${request.issueDate}T12:00:00Z`);
      due.setUTCDate(due.getUTCDate() + 10);
      const response = `<simulado resultado="A" cae="${cae}"/>`;
      return {
        result: { approved: true, cae, caeExpiresAt: due.toISOString().slice(0, 10), observations: [] },
        log: { request: JSON.stringify(request), response },
      };
    },
    async query(voucherType, number) {
      const [row] = await db
        .select()
        .from(schema.invoices)
        .where(and(issued(voucherType), eq(schema.invoices.number, number)))
        .orderBy(desc(schema.invoices.createdAt))
        .limit(1);
      if (!row?.cae || !row.caeExpiresAt) return null;
      return {
        cae: row.cae,
        caeExpiresAt: row.caeExpiresAt,
        amountCents: row.amountCents,
        issueDate: row.issueDate,
        docNumber: row.recipientDocNumber,
      };
    },
    async taxpayer() {
      const [pro] = await db
        .select({ name: schema.professionals.displayName, address: schema.professionals.address })
        .from(schema.professionals)
        .where(eq(schema.professionals.id, connection.professionalId));
      const category = (process.env.ARCA_SIMULADO_CATEGORIA ?? "C").toUpperCase();
      return {
        legalName: pro?.name ?? "Contribuyente simulado",
        fiscalAddress: pro?.address ?? null,
        category,
        categoryDescription: `${category} LOCACIONES DE SERVICIOS`,
      };
    },
  };
}
