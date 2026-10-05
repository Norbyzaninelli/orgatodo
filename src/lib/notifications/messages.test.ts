import { describe, expect, it } from "vitest";
import { buildMessage, textToHtml, type MessageContext } from "./messages";

const context: MessageContext = {
  professionalName: "Laura Gómez",
  clientName: "Pedro",
  serviceName: "Sesión",
  dateText: "lunes 5 de octubre",
  timeText: "18:00",
  address: "Av. Corrientes 1234",
  clientPhone: "11 4444-3333",
  manageUrl: "https://orgatodo.com/turno/abc",
  panelUrl: "https://orgatodo.com/panel",
};

describe("buildMessage", () => {
  it("arma el recordatorio con fecha, hora, dirección y link para cancelar", () => {
    const m = buildMessage("recordatorio", context);
    expect(m.text).toContain("lunes 5 de octubre a las 18:00");
    expect(m.text).toContain("Av. Corrientes 1234");
    expect(m.text).toContain("https://orgatodo.com/turno/abc");
    expect(m.whatsapp.template).toBe("orgatodo_recordatorio");
    expect(m.whatsapp.params).toHaveLength(6);
  });

  it("omite la dirección cuando no hay", () => {
    expect(buildMessage("turno_confirmado", { ...context, address: null }).text).not.toContain("Dirección");
  });

  it("al profesional le manda el link al panel, no el del cliente", () => {
    const m = buildMessage("nuevo_turno", context);
    expect(m.text).toContain("https://orgatodo.com/panel");
    expect(m.text).not.toContain("/turno/abc");
  });
});

describe("textToHtml", () => {
  it("escapa HTML y convierte links", () => {
    const html = textToHtml("Hola <b>\n\nVer https://orgatodo.com/x");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain('<a href="https://orgatodo.com/x"');
  });
});
