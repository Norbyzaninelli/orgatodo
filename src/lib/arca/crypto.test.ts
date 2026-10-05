import forge from "node-forge";
import { describe, expect, it } from "vitest";
import {
  CertificateError,
  decrypt,
  encrypt,
  generateKeyAndCsr,
  inspectCertificate,
  selfSignForTesting,
  signCms,
} from "./crypto";

describe("cifrado", () => {
  it("cifra y descifra", () => {
    const secret = "-----BEGIN RSA PRIVATE KEY-----\nabc\n";
    const payload = encrypt(secret);
    expect(payload).not.toContain("abc");
    expect(decrypt(payload)).toBe(secret);
  });

  it("detecta datos alterados", () => {
    const [iv, tag, data] = encrypt("hola").split(".");
    const tampered = Buffer.from(data, "base64");
    tampered[0] ^= 1;
    expect(() => decrypt([iv, tag, tampered.toString("base64")].join("."))).toThrow();
  });
});

describe("certificado", () => {
  const { privateKeyPem, csrPem } = generateKeyAndCsr({ cuit: "20123456786", name: "Laura Gómez" });

  it("arma el pedido con el CUIT en serialNumber", () => {
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    expect(csr.verify()).toBe(true);
    expect(csr.subject.getField({ name: "serialNumber" }).value).toBe("CUIT 20123456786");
  });

  it("acepta el certificado que corresponde a la clave", () => {
    const cert = selfSignForTesting(csrPem, privateKeyPem);
    const info = inspectCertificate(cert, privateKeyPem);
    expect(info.cuit).toBe("20123456786");
    expect(info.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rechaza un certificado de otra clave", () => {
    const other = generateKeyAndCsr({ cuit: "20123456786", name: "Otra" });
    const cert = selfSignForTesting(other.csrPem, other.privateKeyPem);
    expect(() => inspectCertificate(cert, privateKeyPem)).toThrow(CertificateError);
    expect(() => inspectCertificate("basura", privateKeyPem)).toThrow(CertificateError);
  });

  it("firma un CMS verificable con el contenido adentro", () => {
    const cert = selfSignForTesting(csrPem, privateKeyPem);
    const cms = signCms("<loginTicketRequest/>", cert, privateKeyPem);
    const msg = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.decode64(cms))) as forge.pkcs7.PkcsSignedData & {
      rawCapture: { content: forge.asn1.Asn1 };
    };
    expect(msg.certificates).toHaveLength(1);
    expect(forge.asn1.toDer(msg.rawCapture.content).getBytes()).toContain("<loginTicketRequest/>");
  });
});

describe("clave de cifrado configurada", () => {
  it("acepta hexadecimal y base64", async () => {
    const hex = "a".repeat(64);
    const original = process.env.ARCA_CLAVE_CIFRADO;
    try {
      process.env.ARCA_CLAVE_CIFRADO = hex;
      const withHex = encrypt("x");
      process.env.ARCA_CLAVE_CIFRADO = Buffer.from(hex, "hex").toString("base64");
      expect(decrypt(withHex)).toBe("x");
      process.env.ARCA_CLAVE_CIFRADO = "corta";
      expect(() => encrypt("x")).toThrow(/32 bytes/);
    } finally {
      if (original === undefined) delete process.env.ARCA_CLAVE_CIFRADO;
      else process.env.ARCA_CLAVE_CIFRADO = original;
    }
  });
});
