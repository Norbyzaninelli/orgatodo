import { describe, expect, it } from "vitest";
import type { Invoice } from "@/db/schema";
import { categoryLimitCents } from "./categorias";
import { InvoiceError, normalizeRecipient } from "./invoices";
import { parseGetPersona } from "./padron";
import { invoiceQrUrl, netInvoicedCents, voucherNumber } from "./qr";
import { ArcaError } from "./soap";
import { buildLoginRequest, buildTra, parseLoginResponse } from "./wsaa";
import { buildCaeRequest, parseCaeResponse, parseLastAuthorized, parseQuery } from "./wsfe";

const soap = (body: string) =>
  `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${body}</soap:Body></soap:Envelope>`;

const auth = { token: "TOKEN", sign: "SIGN", cuit: "20123456786" };

describe("WSAA", () => {
  it("arma el TRA con el servicio y una ventana de tiempo", () => {
    const tra = buildTra("wsfe", new Date("2026-10-05T15:00:00Z"));
    expect(tra).toContain("<service>wsfe</service>");
    expect(tra).toContain("<generationTime>2026-10-05T11:50:00-03:00</generationTime>");
    expect(tra).toContain("<expirationTime>2026-10-05T12:10:00-03:00</expirationTime>");
    expect(buildLoginRequest("CMS")).toContain("<wsaa:in0>CMS</wsaa:in0>");
  });

  it("lee el ticket escapado dentro de loginCmsReturn", () => {
    const inner = `<?xml version="1.0" encoding="UTF-8"?><loginTicketResponse version="1.0"><header><source>CN=wsaahomo</source><destination>SERIALNUMBER=CUIT 20123456786</destination><uniqueId>1</uniqueId><generationTime>2026-10-05T12:00:00.000-03:00</generationTime><expirationTime>2026-10-06T00:00:00.000-03:00</expirationTime></header><credentials><token>PD94bWw=</token><sign>c2lnbg==</sign></credentials></loginTicketResponse>`;
    const escaped = inner.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const xml = soap(`<ns1:loginCmsResponse xmlns:ns1="http://wsaa.view.sua.dvadac.desein.afip.gov"><ns1:loginCmsReturn>${escaped}</ns1:loginCmsReturn></ns1:loginCmsResponse>`);
    const ticket = parseLoginResponse(xml);
    expect(ticket.token).toBe("PD94bWw=");
    expect(ticket.sign).toBe("c2lnbg==");
    expect(ticket.expiresAt.toISOString()).toBe("2026-10-06T03:00:00.000Z");
  });

  it("convierte el Fault en ArcaError con su código", () => {
    const xml = soap(`<soapenv:Fault xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><faultcode xmlns:ns1="http://xml.apache.org/axis/">ns1:coe.alreadyAuthenticated</faultcode><faultstring>El CEE ya posee un TA valido para el acceso al WSN solicitado</faultstring></soapenv:Fault>`);
    try {
      parseLoginResponse(xml);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ArcaError);
      expect((error as ArcaError).code).toBe("coe.alreadyAuthenticated");
    }
  });
});

describe("WSFEv1", () => {
  it("lee el último comprobante autorizado", () => {
    const xml = soap(`<FECompUltimoAutorizadoResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompUltimoAutorizadoResult><PtoVta>2</PtoVta><CbteTipo>11</CbteTipo><CbteNro>41</CbteNro></FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse>`);
    expect(parseLastAuthorized(xml)).toBe(41);
  });

  it("lanza los errores de WSFE", () => {
    const xml = soap(`<FECompUltimoAutorizadoResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompUltimoAutorizadoResult><PtoVta>2</PtoVta><CbteTipo>11</CbteTipo><CbteNro>0</CbteNro><Errors><Err><Code>600</Code><Msg>ValidacionDeToken: No aparecio CUIT en lista de relaciones</Msg></Err></Errors></FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse>`);
    expect(() => parseLastAuthorized(xml)).toThrow(/600: ValidacionDeToken/);
  });

  it("arma la factura C de servicios sin IVA", () => {
    const { action, xml } = buildCaeRequest(auth, {
      pointOfSale: 2,
      voucherType: 11,
      number: 42,
      issueDate: "2026-10-05",
      serviceFrom: "2026-10-01",
      serviceTo: "2026-10-01",
      paymentDueDate: "2026-10-05",
      amountCents: 2500050,
      docType: 99,
      docNumber: "0",
      vatCondition: 5,
    });
    expect(action).toBe("http://ar.gov.afip.dif.FEV1/FECAESolicitar");
    expect(xml).toContain("<ar:Concepto>2</ar:Concepto><ar:DocTipo>99</ar:DocTipo><ar:DocNro>0</ar:DocNro>");
    expect(xml).toContain("<ar:CbteDesde>42</ar:CbteDesde><ar:CbteHasta>42</ar:CbteHasta><ar:CbteFch>20261005</ar:CbteFch>");
    expect(xml).toContain("<ar:ImpTotal>25000.50</ar:ImpTotal><ar:ImpTotConc>0</ar:ImpTotConc><ar:ImpNeto>25000.50</ar:ImpNeto>");
    expect(xml).toContain("<ar:ImpIVA>0</ar:ImpIVA><ar:FchServDesde>20261001</ar:FchServDesde>");
    expect(xml).toContain("<ar:CondicionIVAReceptorId>5</ar:CondicionIVAReceptorId>");
    expect(xml).not.toContain("CbtesAsoc");
  });

  it("asocia la factura en la nota de crédito", () => {
    const { xml } = buildCaeRequest(auth, {
      pointOfSale: 2,
      voucherType: 13,
      number: 1,
      issueDate: "2026-10-06",
      serviceFrom: "2026-10-01",
      serviceTo: "2026-10-01",
      paymentDueDate: "2026-10-06",
      amountCents: 100,
      docType: 96,
      docNumber: "30123456",
      vatCondition: 5,
      associated: { voucherType: 11, pointOfSale: 2, number: 42, cuit: "20123456786", issueDate: "2026-10-05" },
    });
    expect(xml).toContain(
      "<ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>11</ar:Tipo><ar:PtoVta>2</ar:PtoVta><ar:Nro>42</ar:Nro><ar:Cuit>20123456786</ar:Cuit><ar:CbteFch>20261005</ar:CbteFch></ar:CbteAsoc></ar:CbtesAsoc>",
    );
  });

  it("lee un CAE aprobado con observaciones", () => {
    const xml = soap(`<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult><FeCabResp><Cuit>20123456786</Cuit><PtoVta>2</PtoVta><CbteTipo>11</CbteTipo><Resultado>A</Resultado></FeCabResp><FeDetResp><FECAEDetResponse><Concepto>2</Concepto><Resultado>A</Resultado><Observaciones><Obs><Code>10217</Code><Msg>Observación de prueba</Msg></Obs></Observaciones><CAE>76401234567890</CAE><CAEFchVto>20261015</CAEFchVto></FECAEDetResponse></FeDetResp></FECAESolicitarResult></FECAESolicitarResponse>`);
    expect(parseCaeResponse(xml)).toEqual({
      approved: true,
      cae: "76401234567890",
      caeExpiresAt: "2026-10-15",
      observations: [{ code: "10217", msg: "Observación de prueba" }],
    });
  });

  it("lee un rechazo con sus motivos", () => {
    const xml = soap(`<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult><FeCabResp><Resultado>R</Resultado></FeCabResp><FeDetResp><FECAEDetResponse><Resultado>R</Resultado><Observaciones><Obs><Code>10016</Code><Msg>El numero de comprobante no es el proximo a autorizar</Msg></Obs><Obs><Code>10242</Code><Msg>Condicion IVA receptor no valida</Msg></Obs></Observaciones><CAE></CAE></FECAEDetResponse></FeDetResp></FECAESolicitarResult></FECAESolicitarResponse>`);
    const result = parseCaeResponse(xml);
    expect(result.approved).toBe(false);
    expect(result.observations.map((o) => o.code)).toEqual(["10016", "10242"]);
  });

  it("consulta un comprobante y reconoce el que no existe", () => {
    const found = soap(`<FECompConsultarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompConsultarResult><ResultGet><CbteFch>20261005</CbteFch><DocNro>0</DocNro><ImpTotal>25000.5</ImpTotal><CodAutorizacion>76401234567890</CodAutorizacion><FchVto>20261015</FchVto><Resultado>A</Resultado></ResultGet></FECompConsultarResult></FECompConsultarResponse>`);
    expect(parseQuery(found)).toEqual({
      cae: "76401234567890",
      caeExpiresAt: "2026-10-15",
      amountCents: 2500050,
      issueDate: "2026-10-05",
      docNumber: "0",
    });
    const missing = soap(`<FECompConsultarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompConsultarResult><Errors><Err><Code>602</Code><Msg>No existen datos en nuestros registros para los parametros ingresados.</Msg></Err></Errors></FECompConsultarResult></FECompConsultarResponse>`);
    expect(parseQuery(missing)).toBeNull();
  });
});

describe("constancia de inscripción", () => {
  it("saca la categoría de monotributo de la descripción", () => {
    const xml = soap(`<ns2:getPersona_v2Response xmlns:ns2="http://a5.soap.ws.server.puc.sr/"><personaReturn><datosGenerales><apellido>GOMEZ</apellido><nombre>LAURA</nombre><domicilioFiscal><direccion>AV CORRIENTES 1234</direccion><localidad>CAPITAL FEDERAL</localidad><descripcionProvincia>CIUDAD AUTONOMA BUENOS AIRES</descripcionProvincia></domicilioFiscal><tipoPersona>FISICA</tipoPersona></datosGenerales><datosMonotributo><categoriaMonotributo><descripcionCategoria>H LOCACIONES DE SERVICIOS</descripcionCategoria><idCategoria>21</idCategoria><idImpuesto>20</idImpuesto><periodo>202608</periodo></categoriaMonotributo></datosMonotributo></personaReturn></ns2:getPersona_v2Response>`);
    expect(parseGetPersona(xml)).toEqual({
      legalName: "GOMEZ LAURA",
      fiscalAddress: "AV CORRIENTES 1234, CAPITAL FEDERAL, CIUDAD AUTONOMA BUENOS AIRES",
      category: "H",
      categoryDescription: "H LOCACIONES DE SERVICIOS",
    });
  });

  it("devuelve sin categoría a quien no es monotributista", () => {
    const xml = soap(`<ns2:getPersona_v2Response xmlns:ns2="http://a5.soap.ws.server.puc.sr/"><personaReturn><datosGenerales><razonSocial>EMPRESA SA</razonSocial></datosGenerales><datosRegimenGeneral><impuesto><idImpuesto>30</idImpuesto></impuesto></datosRegimenGeneral></personaReturn></ns2:getPersona_v2Response>`);
    expect(parseGetPersona(xml).category).toBeNull();
  });
});

describe("comprobantes", () => {
  const invoice = {
    type: "factura_c",
    status: "emitida",
    issueDate: "2026-10-05",
    cuit: "20123456786",
    pointOfSale: 2,
    number: 42,
    amountCents: 2500050,
    recipientDocType: 96,
    recipientDocNumber: "30123456",
    cae: "76401234567890",
  } as Invoice;

  it("arma el QR con los datos de la RG 4291", () => {
    const url = invoiceQrUrl(invoice)!;
    const data = JSON.parse(Buffer.from(url.split("?p=")[1], "base64").toString());
    expect(data).toEqual({
      ver: 1,
      fecha: "2026-10-05",
      cuit: 20123456786,
      ptoVta: 2,
      tipoCmp: 11,
      nroCmp: 42,
      importe: 25000.5,
      moneda: "PES",
      ctz: 1,
      tipoDocRec: 96,
      nroDocRec: 30123456,
      tipoCodAut: "E",
      codAut: 76401234567890,
    });
    expect(voucherNumber(invoice)).toBe("00002-00000042");
  });

  it("descuenta las notas de crédito del facturado", () => {
    expect(
      netInvoicedCents([
        { type: "factura_c", status: "emitida", amountCents: 1000 },
        { type: "factura_c", status: "anulada", amountCents: 500 },
        { type: "nota_credito_c", status: "emitida", amountCents: 500 },
        { type: "factura_c", status: "rechazada", amountCents: 9999 },
        { type: "factura_c", status: "emitiendo", amountCents: 9999 },
      ]),
    ).toBe(1000);
  });

  it("valida el receptor", () => {
    expect(normalizeRecipient({ docType: 99, name: "Ana", email: null })).toMatchObject({ docNumber: "0", vatCondition: 5 });
    expect(normalizeRecipient({ docType: 96, docNumber: "30.123.456", name: "Ana", email: null }).docNumber).toBe("30123456");
    expect(() => normalizeRecipient({ docType: 96, docNumber: "12", name: "Ana", email: null })).toThrow(InvoiceError);
    expect(normalizeRecipient({ docType: 80, docNumber: "20-12345678-6", vatCondition: 6, name: "Ana", email: null })).toMatchObject({
      docNumber: "20123456786",
      vatCondition: 6,
    });
  });

  it("toma el límite de la tabla vigente", () => {
    const tables = [
      { validFrom: "2026-02-01", limitsCents: { A: 100, H: 800 } },
      { validFrom: "2026-08-01", limitsCents: { A: 120, H: 900 } },
    ];
    expect(categoryLimitCents("H", "2026-07-31", tables)).toBe(800);
    expect(categoryLimitCents("h", "2026-10-05", tables)).toBe(900);
    expect(categoryLimitCents("K", "2026-10-05", tables)).toBeNull();
    expect(categoryLimitCents("A", "2025-12-01", tables)).toBeNull();
    expect(categoryLimitCents(null, "2026-10-05", tables)).toBeNull();
  });
});
