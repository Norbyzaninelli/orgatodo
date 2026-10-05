/**
 * Envío real por Resend (email) y la API de WhatsApp Cloud de Meta.
 * Sin credenciales configuradas, los mensajes se escriben en el log del servidor ("modo prueba"),
 * así se puede desarrollar y probar sin cuentas.
 */

export interface SendResult {
  mode: "real" | "prueba";
  providerId?: string;
}

export async function sendEmail(input: { to: string; subject: string; text: string; html: string }): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.info(`[avisos:prueba] email a ${input.to}: ${input.subject}\n${input.text}`);
    return { mode: "prueba" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text, html: input.html }),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const body = (await response.json()) as { id?: string };
  return { mode: "real", providerId: body.id };
}

export async function sendWhatsapp(input: { to: string; template: string; params: string[] }): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    console.info(`[avisos:prueba] WhatsApp a +${input.to}: ${input.template} ${JSON.stringify(input.params)}`);
    return { mode: "prueba" };
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: input.template,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "es_AR" },
        components: [{ type: "body", parameters: input.params.map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  if (!response.ok) throw new Error(`WhatsApp ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const body = (await response.json()) as { messages?: { id: string }[] };
  return { mode: "real", providerId: body.messages?.[0]?.id };
}
