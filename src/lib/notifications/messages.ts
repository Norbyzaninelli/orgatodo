import type { Notification } from "@/db/schema";

export interface MessageContext {
  professionalName: string;
  clientName: string;
  serviceName: string;
  /** "lunes 5 de octubre" */
  dateText: string;
  /** "18:00" */
  timeText: string;
  address: string | null;
  clientPhone: string | null;
  /** Link del cliente para ver o cancelar el turno. */
  manageUrl: string;
  /** Panel del profesional. */
  panelUrl: string;
}

export interface Message {
  subject: string;
  text: string;
  /**
   * WhatsApp solo deja iniciar conversaciones con plantillas aprobadas por Meta.
   * El nombre y el orden de los parámetros tienen que coincidir con docs/plantillas-whatsapp.md.
   */
  whatsapp: { template: string; params: string[] };
}

type Kind = Notification["kind"];

const builders: Record<Kind, (c: MessageContext) => Message> = {
  reserva_recibida: (c) => ({
    subject: `Recibimos tu reserva con ${c.professionalName}`,
    text: [
      `Hola ${c.clientName}, recibimos tu reserva de ${c.serviceName} con ${c.professionalName} para el ${c.dateText} a las ${c.timeText}.`,
      `${c.professionalName} la va a confirmar y te avisamos.`,
      `Para ver o cancelar el turno: ${c.manageUrl}`,
    ].join("\n\n"),
    whatsapp: {
      template: "orgatodo_reserva_recibida",
      params: [c.clientName, c.serviceName, c.professionalName, c.dateText, c.timeText, c.manageUrl],
    },
  }),
  turno_confirmado: (c) => ({
    subject: `Turno confirmado con ${c.professionalName}`,
    text: [
      `Hola ${c.clientName}, tu turno de ${c.serviceName} con ${c.professionalName} quedó confirmado para el ${c.dateText} a las ${c.timeText}.`,
      c.address ? `Dirección: ${c.address}` : null,
      `Para ver o cancelar el turno: ${c.manageUrl}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    whatsapp: {
      template: "orgatodo_turno_confirmado",
      params: [c.clientName, c.serviceName, c.professionalName, c.dateText, c.timeText, c.manageUrl],
    },
  }),
  nuevo_turno: (c) => ({
    subject: `Nuevo turno: ${c.clientName}, ${c.dateText} ${c.timeText}`,
    text: [
      `Tenés un turno nuevo de ${c.clientName} para ${c.serviceName} el ${c.dateText} a las ${c.timeText}.`,
      c.clientPhone ? `Teléfono: ${c.clientPhone}` : null,
      `Ver en tu panel: ${c.panelUrl}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    whatsapp: {
      template: "orgatodo_nuevo_turno",
      params: [c.clientName, c.serviceName, c.dateText, c.timeText, c.panelUrl],
    },
  }),
  recordatorio: (c) => ({
    subject: `Recordatorio: turno con ${c.professionalName} el ${c.dateText}`,
    text: [
      `Hola ${c.clientName}, te recordamos tu turno de ${c.serviceName} con ${c.professionalName} el ${c.dateText} a las ${c.timeText}.`,
      c.address ? `Dirección: ${c.address}` : null,
      `Si no podés ir, cancelalo acá: ${c.manageUrl}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    whatsapp: {
      template: "orgatodo_recordatorio",
      params: [c.clientName, c.serviceName, c.professionalName, c.dateText, c.timeText, c.manageUrl],
    },
  }),
  cancelado_por_cliente: (c) => ({
    subject: `${c.clientName} canceló su turno del ${c.dateText}`,
    text: [
      `${c.clientName} canceló su turno de ${c.serviceName} del ${c.dateText} a las ${c.timeText}. El horario quedó libre.`,
      `Ver en tu panel: ${c.panelUrl}`,
    ].join("\n\n"),
    whatsapp: {
      template: "orgatodo_cancelado_por_cliente",
      params: [c.clientName, c.serviceName, c.dateText, c.timeText],
    },
  }),
  cancelado_por_profesional: (c) => ({
    subject: `Tu turno con ${c.professionalName} fue cancelado`,
    text: [
      `Hola ${c.clientName}, ${c.professionalName} canceló tu turno de ${c.serviceName} del ${c.dateText} a las ${c.timeText}.`,
      `Podés reservar otro horario desde su página.`,
    ].join("\n\n"),
    whatsapp: {
      template: "orgatodo_cancelado_por_profesional",
      params: [c.clientName, c.professionalName, c.serviceName, c.dateText, c.timeText],
    },
  }),
  pedido_resena: (c) => ({
    subject: `¿Cómo te fue con ${c.professionalName}?`,
    text: [
      `Hola ${c.clientName}, gracias por tu turno de ${c.serviceName} con ${c.professionalName}.`,
      `¿Nos contás cómo te fue? Te lleva un minuto y ayuda a otras personas a elegir: ${c.manageUrl}/resena`,
    ].join("\n\n"),
    whatsapp: {
      template: "orgatodo_pedido_resena",
      params: [c.clientName, c.serviceName, c.professionalName, `${c.manageUrl}/resena`],
    },
  }),
};

export function buildMessage(kind: Kind, context: MessageContext): Message {
  return builders[kind](context);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** HTML simple para el email, con los links clickeables. */
export function textToHtml(text: string): string {
  const paragraphs = text.split("\n\n").map((p) => {
    const linked = escapeHtml(p).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2340a8">$1</a>');
    return `<p style="margin:0 0 16px">${linked}</p>`;
  });
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c1d1f;max-width:520px">
<p style="margin:0 0 20px;font-weight:bold;color:#2340a8">ORGATODO</p>${paragraphs.join("")}</div>`;
}
