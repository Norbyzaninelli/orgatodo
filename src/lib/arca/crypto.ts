import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import forge from "node-forge";

/**
 * Clave para cifrar las claves privadas de los profesionales. En producción tiene que venir de
 * ARCA_CLAVE_CIFRADO (32 bytes en base64); en desarrollo se deriva del secreto de sesiones.
 */
function encryptionKey(): Buffer {
  const configured = process.env.ARCA_CLAVE_CIFRADO;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32) throw new Error("ARCA_CLAVE_CIFRADO tiene que tener 32 bytes en base64");
    return key;
  }
  if (process.env.ARCA_MODO === "produccion") throw new Error("Falta ARCA_CLAVE_CIFRADO");
  const secret = process.env.BETTER_AUTH_SECRET ?? "orgatodo-desarrollo";
  return createHash("sha256").update(`arca:${secret}`).digest();
}

/** AES-256-GCM. Resultado: iv.tag.datos, cada parte en base64. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/**
 * Genera la clave privada y el pedido de certificado (CSR) que el profesional sube a ARCA.
 * ARCA identifica al contribuyente por el serialNumber "CUIT <número>".
 */
export function generateKeyAndCsr({ cuit, name }: { cuit: string; name: string }) {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([
    { shortName: "C", value: "AR" },
    { shortName: "O", value: name.slice(0, 60) },
    { shortName: "CN", value: `orgatodo${cuit}` },
    { name: "serialNumber", value: `CUIT ${cuit}` },
  ]);
  csr.sign(keys.privateKey, forge.md.sha256.create());
  return {
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    csrPem: forge.pki.certificationRequestToPem(csr),
  };
}

export interface CertificateInfo {
  expiresAt: Date;
  notBefore: Date;
  /** CUIT que figura en el certificado, si lo trae. */
  cuit: string | null;
}

export class CertificateError extends Error {}

/** Lee un certificado PEM y verifica que corresponda a la clave privada guardada. */
export function inspectCertificate(certificatePem: string, privateKeyPem: string): CertificateInfo {
  let cert: forge.pki.Certificate;
  try {
    cert = forge.pki.certificateFromPem(certificatePem.trim());
  } catch {
    throw new CertificateError("No pudimos leer el certificado. Subí el archivo .crt que descargaste de ARCA.");
  }
  const key = forge.pki.privateKeyFromPem(privateKeyPem);
  const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
  if (publicKey.n.compareTo(key.n) !== 0) {
    throw new CertificateError(
      "Ese certificado no corresponde al pedido que generamos. Subí el certificado creado con el último pedido descargado.",
    );
  }
  const serial = cert.subject.attributes.find((a) => a.name === "serialNumber")?.value;
  const cuit = typeof serial === "string" ? (serial.match(/(\d{11})/)?.[1] ?? null) : null;
  return { expiresAt: cert.validity.notAfter, notBefore: cert.validity.notBefore, cuit };
}

/** Firma un texto como CMS (PKCS#7 SignedData con el contenido adentro), en base64, como pide WSAA. */
export function signCms(content: string, certificatePem: string, privateKeyPem: string): string {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(content, "utf8");
  const certificate = forge.pki.certificateFromPem(certificatePem);
  p7.addCertificate(certificate);
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(privateKeyPem),
    certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

/** Solo para el modo simulado: firma el pedido con un certificado propio, como haría ARCA. */
export function selfSignForTesting(csrPem: string, privateKeyPem: string, days = 730): string {
  const csr = forge.pki.certificationRequestFromPem(csrPem);
  const cert = forge.pki.createCertificate();
  cert.publicKey = csr.publicKey as forge.pki.PublicKey;
  cert.serialNumber = randomBytes(8).toString("hex");
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + days * 86_400_000);
  cert.setSubject(csr.subject.attributes);
  cert.setIssuer([{ shortName: "CN", value: "ORGATODO simulado" }]);
  cert.sign(forge.pki.privateKeyFromPem(privateKeyPem), forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}
