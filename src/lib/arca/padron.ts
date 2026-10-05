import { asArray, ArcaError, envelope, escapeXml, soapBody } from "./soap";

export const PADRON_NS = "http://a5.soap.ws.server.puc.sr/";

/** Constancia de inscripción (padrón A5). Los hijos van sin prefijo, como pide el servicio. */
export function buildGetPersona(auth: { token: string; sign: string; cuit: string }, idPersona: string) {
  return {
    action: "",
    xml: envelope(
      { a5: PADRON_NS },
      `<a5:getPersona_v2><token>${escapeXml(auth.token)}</token><sign>${escapeXml(auth.sign)}</sign><cuitRepresentada>${auth.cuit}</cuitRepresentada><idPersona>${idPersona}</idPersona></a5:getPersona_v2>`,
    ),
  };
}

export interface Taxpayer {
  legalName: string;
  fiscalAddress: string | null;
  /** Letra de la categoría, null si no figura como monotributista. */
  category: string | null;
  categoryDescription: string | null;
}

type Node = Record<string, unknown>;

export function parseGetPersona(xml: string): Taxpayer {
  const body = soapBody(xml);
  const persona = (body.getPersona_v2Response as Node | undefined)?.personaReturn as Node | undefined;
  if (!persona) throw new ArcaError("La constancia de inscripción vino vacía");

  const error = persona.errorConstancia as Node | undefined;
  const general = persona.datosGenerales as Node | undefined;
  if (!general) {
    const detail = asArray(error?.error as string | string[] | undefined).join(" | ");
    throw new ArcaError(detail || "ARCA no devolvió los datos de la constancia");
  }

  const legalName =
    String(general.razonSocial ?? "") ||
    [general.apellido, general.nombre].filter(Boolean).join(" ").trim() ||
    "Sin nombre";

  const address = general.domicilioFiscal as Node | undefined;
  const fiscalAddress = address
    ? [address.direccion, address.localidad, address.descripcionProvincia].filter(Boolean).join(", ") || null
    : null;

  const monotributo = persona.datosMonotributo as Node | undefined;
  const categoryNode = asArray(monotributo?.categoriaMonotributo as Node | Node[] | undefined)[0];
  const description = categoryNode?.descripcionCategoria ? String(categoryNode.descripcionCategoria) : null;
  // La descripción empieza con la letra: "H LOCACIONES DE SERVICIOS".
  const category = description?.match(/^\s*([A-K])\b/i)?.[1]?.toUpperCase() ?? null;

  return { legalName, fiscalAddress, category, categoryDescription: description };
}
