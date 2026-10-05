export type ArcaMode = "simulado" | "homologacion" | "produccion";

/**
 * Con qué ARCA habla la plataforma. "simulado" no sale a internet: sirve para desarrollar y
 * para probar el circuito sin certificado. "homologacion" es el ambiente de prueba de ARCA.
 */
export function arcaMode(): ArcaMode {
  const value = process.env.ARCA_MODO;
  return value === "homologacion" || value === "produccion" ? value : "simulado";
}

export const ENDPOINTS = {
  homologacion: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
    padron: "https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5",
  },
  produccion: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
    padron: "https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5",
  },
} as const;

/** Nombres de servicio que se piden a WSAA. */
export const SERVICES = { wsfe: "wsfe", padron: "ws_sr_constancia_inscripcion" } as const;

/** Códigos de ARCA. */
export const VOUCHER_TYPE = { factura_c: 11, nota_credito_c: 13 } as const;
export const DOC_TYPE = { cuit: 80, dni: 96, sinIdentificar: 99 } as const;
export const VAT_CONDITION = {
  consumidorFinal: 5,
  responsableInscripto: 1,
  exento: 4,
  monotributo: 6,
} as const;
export const VAT_CONDITION_LABELS: Record<number, string> = {
  5: "Consumidor final",
  1: "IVA Responsable inscripto",
  4: "IVA Sujeto exento",
  6: "Responsable monotributo",
};
