import { randomInt } from "node:crypto";
import { envelope, escapeXml, parseXml, soapBody, ArcaError } from "./soap";

/** Fecha con zona horaria, como la pide WSAA: 2026-10-05T13:00:00-03:00 */
function isoWithOffset(date: Date): string {
  const local = new Date(date.getTime() - 3 * 3_600_000);
  return `${local.toISOString().slice(0, 19)}-03:00`;
}

/** Ticket de pedido de acceso (TRA) para un servicio. */
export function buildTra(service: string, now = new Date()): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<loginTicketRequest version="1.0"><header>',
    `<uniqueId>${randomInt(1, 2 ** 31 - 1)}</uniqueId>`,
    `<generationTime>${isoWithOffset(new Date(now.getTime() - 10 * 60_000))}</generationTime>`,
    `<expirationTime>${isoWithOffset(new Date(now.getTime() + 10 * 60_000))}</expirationTime>`,
    `</header><service>${escapeXml(service)}</service></loginTicketRequest>`,
  ].join("");
}

export function buildLoginRequest(cms: string): string {
  return envelope(
    { wsaa: "http://wsaa.view.sua.dvadac.desein.afip.gov" },
    `<wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms>`,
  );
}

export interface Ticket {
  token: string;
  sign: string;
  expiresAt: Date;
}

/** La respuesta trae el ticket como XML escapado dentro de loginCmsReturn. */
export function parseLoginResponse(xml: string): Ticket {
  const body = soapBody(xml);
  const inner = (body.loginCmsResponse as Record<string, unknown> | undefined)?.loginCmsReturn;
  if (typeof inner !== "string") throw new ArcaError("WSAA no devolvió el permiso de acceso");
  const ticket = parseXml(inner).loginTicketResponse as Record<string, Record<string, string>> | undefined;
  const token = ticket?.credentials?.token;
  const sign = ticket?.credentials?.sign;
  const expiration = ticket?.header?.expirationTime;
  if (!token || !sign || !expiration) throw new ArcaError("El permiso de acceso de WSAA vino incompleto");
  return { token, sign, expiresAt: new Date(expiration) };
}
