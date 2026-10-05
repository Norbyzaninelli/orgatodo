import { asArray, ArcaError, envelope, escapeXml, soapBody } from "./soap";

export const WSFE_NS = "http://ar.gov.afip.dif.FEV1/";

export interface Auth {
  token: string;
  sign: string;
  cuit: string;
}

export interface Message {
  code: string;
  msg: string;
}

function authXml(a: Auth): string {
  return `<ar:Auth><ar:Token>${escapeXml(a.token)}</ar:Token><ar:Sign>${escapeXml(a.sign)}</ar:Sign><ar:Cuit>${a.cuit}</ar:Cuit></ar:Auth>`;
}

function wrap(operation: string, inner: string): { action: string; xml: string } {
  return {
    action: `${WSFE_NS}${operation}`,
    xml: envelope({ ar: WSFE_NS }, `<ar:${operation}>${inner}</ar:${operation}>`),
  };
}

/** 2026-10-05 → 20261005 */
export function toArcaDate(date: string): string {
  return date.replace(/-/g, "");
}

/** 20261005 → 2026-10-05 */
export function fromArcaDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function amount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function messages(node: unknown, key: string): Message[] {
  const container = node as Record<string, unknown> | undefined;
  return asArray(container?.[key] as Record<string, string> | Record<string, string>[] | undefined).map((m) => ({
    code: String(m.Code ?? ""),
    msg: String(m.Msg ?? ""),
  }));
}

function result(xml: string, operation: string): Record<string, unknown> {
  const body = soapBody(xml);
  const response = body[`${operation}Response`] as Record<string, unknown> | undefined;
  const res = response?.[`${operation}Result`] as Record<string, unknown> | undefined;
  if (!res) throw new ArcaError(`WSFE no devolvió ${operation}`);
  return res;
}

function throwErrors(res: Record<string, unknown>, allowed: string[] = []) {
  const errors = messages(res.Errors, "Err").filter((e) => !allowed.includes(e.code));
  if (errors.length > 0) {
    const transient = errors.some((e) => e.code === "500" || e.code === "501" || e.code === "502");
    throw new ArcaError(errors.map((e) => `${e.code}: ${e.msg}`).join(" | "), errors[0].code, transient);
  }
}

// --- Último comprobante autorizado ---------------------------------------

export function buildLastAuthorized(auth: Auth, pointOfSale: number, voucherType: number) {
  return wrap(
    "FECompUltimoAutorizado",
    `${authXml(auth)}<ar:PtoVta>${pointOfSale}</ar:PtoVta><ar:CbteTipo>${voucherType}</ar:CbteTipo>`,
  );
}

export function parseLastAuthorized(xml: string): number {
  const res = result(xml, "FECompUltimoAutorizado");
  throwErrors(res);
  return Number(res.CbteNro ?? 0);
}

// --- Pedido de CAE ---------------------------------------------------------

export interface CaeRequest {
  pointOfSale: number;
  voucherType: number;
  number: number;
  issueDate: string;
  serviceFrom: string;
  serviceTo: string;
  paymentDueDate: string;
  amountCents: number;
  docType: number;
  docNumber: string;
  vatCondition: number;
  /** Para notas de crédito: la factura que anulan. */
  associated?: { voucherType: number; pointOfSale: number; number: number; cuit: string; issueDate: string };
}

/**
 * Factura o nota de crédito C, concepto 2 (servicios). En comprobantes C no se discrimina IVA:
 * el total es el neto y los demás importes van en cero. El orden de los campos sigue el WSDL.
 */
export function buildCaeRequest(auth: Auth, r: CaeRequest) {
  const associated = r.associated
    ? `<ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>${r.associated.voucherType}</ar:Tipo><ar:PtoVta>${r.associated.pointOfSale}</ar:PtoVta><ar:Nro>${r.associated.number}</ar:Nro><ar:Cuit>${r.associated.cuit}</ar:Cuit><ar:CbteFch>${toArcaDate(r.associated.issueDate)}</ar:CbteFch></ar:CbteAsoc></ar:CbtesAsoc>`
    : "";
  const detail = [
    `<ar:Concepto>2</ar:Concepto>`,
    `<ar:DocTipo>${r.docType}</ar:DocTipo>`,
    `<ar:DocNro>${escapeXml(r.docNumber)}</ar:DocNro>`,
    `<ar:CbteDesde>${r.number}</ar:CbteDesde>`,
    `<ar:CbteHasta>${r.number}</ar:CbteHasta>`,
    `<ar:CbteFch>${toArcaDate(r.issueDate)}</ar:CbteFch>`,
    `<ar:ImpTotal>${amount(r.amountCents)}</ar:ImpTotal>`,
    `<ar:ImpTotConc>0</ar:ImpTotConc>`,
    `<ar:ImpNeto>${amount(r.amountCents)}</ar:ImpNeto>`,
    `<ar:ImpOpEx>0</ar:ImpOpEx>`,
    `<ar:ImpTrib>0</ar:ImpTrib>`,
    `<ar:ImpIVA>0</ar:ImpIVA>`,
    `<ar:FchServDesde>${toArcaDate(r.serviceFrom)}</ar:FchServDesde>`,
    `<ar:FchServHasta>${toArcaDate(r.serviceTo)}</ar:FchServHasta>`,
    `<ar:FchVtoPago>${toArcaDate(r.paymentDueDate)}</ar:FchVtoPago>`,
    `<ar:MonId>PES</ar:MonId>`,
    `<ar:MonCotiz>1</ar:MonCotiz>`,
    `<ar:CondicionIVAReceptorId>${r.vatCondition}</ar:CondicionIVAReceptorId>`,
    associated,
  ].join("");
  return wrap(
    "FECAESolicitar",
    `${authXml(auth)}<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${r.pointOfSale}</ar:PtoVta><ar:CbteTipo>${r.voucherType}</ar:CbteTipo></ar:FeCabReq><ar:FeDetReq><ar:FECAEDetRequest>${detail}</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>`,
  );
}

export type CaeResult =
  | { approved: true; cae: string; caeExpiresAt: string; observations: Message[] }
  | { approved: false; observations: Message[]; errors: Message[] };

export function parseCaeResponse(xml: string): CaeResult {
  const res = result(xml, "FECAESolicitar");
  const errors = messages(res.Errors, "Err");
  const detail = asArray<Record<string, unknown>>(
    (res.FeDetResp as Record<string, unknown> | undefined)?.FECAEDetResponse as Record<string, unknown> | undefined,
  )[0] as Record<string, unknown> | undefined;
  const observations = messages(detail?.Observaciones, "Obs");
  if (detail?.Resultado === "A" && typeof detail.CAE === "string" && detail.CAE) {
    return { approved: true, cae: detail.CAE, caeExpiresAt: fromArcaDate(String(detail.CAEFchVto)), observations };
  }
  // Errores generales sin detalle (por ejemplo, ARCA caído) conviene reintentarlos.
  if (!detail && errors.length > 0) throwErrors(res);
  return { approved: false, observations, errors };
}

// --- Consulta de un comprobante -------------------------------------------

export function buildQuery(auth: Auth, pointOfSale: number, voucherType: number, number: number) {
  return wrap(
    "FECompConsultar",
    `${authXml(auth)}<ar:FeCompConsReq><ar:CbteTipo>${voucherType}</ar:CbteTipo><ar:CbteNro>${number}</ar:CbteNro><ar:PtoVta>${pointOfSale}</ar:PtoVta></ar:FeCompConsReq>`,
  );
}

export interface QueriedVoucher {
  cae: string;
  caeExpiresAt: string;
  amountCents: number;
  issueDate: string;
  docNumber: string;
}

/** null si ARCA no tiene ese comprobante (error 602). */
export function parseQuery(xml: string): QueriedVoucher | null {
  const res = result(xml, "FECompConsultar");
  if (messages(res.Errors, "Err").some((e) => e.code === "602")) return null;
  throwErrors(res);
  const get = res.ResultGet as Record<string, string> | undefined;
  if (!get?.CodAutorizacion) return null;
  return {
    cae: get.CodAutorizacion,
    caeExpiresAt: fromArcaDate(get.FchVto),
    amountCents: Math.round(Number(get.ImpTotal) * 100),
    issueDate: fromArcaDate(get.CbteFch),
    docNumber: String(get.DocNro ?? ""),
  };
}
