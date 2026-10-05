import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

export class ArcaError extends Error {
  constructor(
    message: string,
    /** Código de ARCA o del error SOAP, si lo hay. */
    readonly code?: string,
    /** true si conviene reintentar: ARCA no respondió o respondió con un error del servidor. */
    readonly transient = false,
  ) {
    super(message);
  }
}

export function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseXml(xml: string): Record<string, unknown> {
  return parser.parse(xml) as Record<string, unknown>;
}

/** Siempre devuelve un arreglo, venga un elemento, varios o ninguno. */
export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

/** Devuelve el contenido del Body, o lanza el Fault de SOAP como ArcaError. */
export function soapBody(xml: string): Record<string, unknown> {
  const doc = parseXml(xml);
  const envelope = doc.Envelope as Record<string, unknown> | undefined;
  const body = envelope?.Body as Record<string, unknown> | undefined;
  if (!body) throw new ArcaError("ARCA respondió algo que no es SOAP", undefined, true);
  const fault = body.Fault as Record<string, unknown> | undefined;
  if (fault) {
    const code = String(fault.faultcode ?? "").replace(/^.*:/, "");
    throw new ArcaError(String(fault.faultstring ?? "Error de ARCA"), code);
  }
  return body;
}

export function envelope(namespaces: Record<string, string>, body: string): string {
  const ns = Object.entries(namespaces)
    .map(([prefix, uri]) => ` xmlns:${prefix}="${uri}"`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"${ns}><soapenv:Header/><soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`;
}

/** Hace el pedido SOAP. Un corte de red o un 5xx sin Fault se marca como reintentable. */
export async function soapRequest(url: string, soapAction: string, xml: string, timeoutMs = 30_000): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${soapAction}"` },
      body: xml,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new ArcaError(`No pudimos comunicarnos con ARCA: ${(error as Error).message}`, undefined, true);
  }
  const text = await response.text();
  if (!response.ok && !text.includes("Fault>")) {
    throw new ArcaError(`ARCA respondió ${response.status}`, String(response.status), response.status >= 500);
  }
  return text;
}
