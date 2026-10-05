import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, notExists, sql } from "drizzle-orm";
import { ActionForm } from "@/components/action-form";
import { InvoiceFields } from "@/components/invoice-fields";
import { db, schema } from "@/db";
import type { ArcaConnection } from "@/db/schema";
import { requireProfessional } from "@/lib/auth";
import { toLocalDate } from "@/lib/agenda/slots";
import { arcaMode } from "@/lib/arca/config";
import { getConnection } from "@/lib/arca/connection";
import { formatCuit } from "@/lib/arca/cuit";
import { INVOICE_TYPE_LABEL, voucherNumber } from "@/lib/arca/qr";
import { capitalize, formatDayChip, formatLongDate, formatPrice } from "@/lib/format";
import { inputClass } from "@/lib/form-state";
import {
  applyTestCertificateAction,
  creditInvoiceAction,
  invoiceBookingAction,
  refreshCategoryAction,
  retryInvoiceAction,
  saveLegendsAction,
  startConnectionAction,
  uploadCertificateAction,
  verifyConnectionAction,
} from "./actions";

export const metadata: Metadata = { title: "Facturación" };

const ENV_LABEL = { simulado: "Simulado", homologacion: "Homologación (prueba de ARCA)", produccion: "Producción" } as const;

export default async function InvoicingPage({ searchParams }: PageProps<"/panel/facturacion">) {
  const pro = await requireProfessional();
  const connection = await getConnection(pro.id);
  const { emitido } = await searchParams;

  if (!connection) {
    return (
      <div className="space-y-6">
        <Intro />
        <StepOne />
      </div>
    );
  }
  if (!connection.verifiedAt) return <SetupCertificate connection={connection} />;
  return (
    <Connected
      connection={connection}
      professionalId={pro.id}
      timezone={pro.timezone}
      issuedId={typeof emitido === "string" ? emitido : null}
    />
  );
}

function Intro() {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">Conectá tu facturación con ARCA</h2>
      <p className="text-sm text-muted">
        Emitís tus facturas C desde cada turno, con tu propio CUIT y tu certificado digital. La plataforma nunca factura
        en tu nombre sin que vos lo pidas. Al conectar, leemos tu categoría de monotributo para avisarte cuánto llevás
        facturado.
      </p>
    </section>
  );
}

function StepOne({ connection }: { connection?: ArcaConnection }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h3 className="font-semibold">1. Tu CUIT y punto de venta</h3>
      <p className="text-sm text-muted">
        En ARCA, entrá a &quot;Administración de puntos de venta y domicilios&quot; y creá un punto de venta del tipo{" "}
        <strong>RECE para aplicativo y web services</strong>. Usá uno nuevo, distinto del de Comprobantes en línea, así la
        numeración no se cruza.
      </p>
      <ActionForm action={startConnectionAction} submitLabel={connection ? "Generar un pedido nuevo" : "Continuar"} pendingLabel="Generando...">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            CUIT
            <input name="cuit" required inputMode="numeric" defaultValue={connection ? formatCuit(connection.cuit) : ""} placeholder="20-12345678-6" className={inputClass} />
          </label>
          <label className="block text-sm">
            Punto de venta
            <input name="pointOfSale" required inputMode="numeric" defaultValue={connection?.pointOfSale ?? ""} placeholder="2" className={inputClass} />
          </label>
        </div>
        {connection && <p className="text-sm text-muted">Al generar un pedido nuevo vas a tener que subir un certificado nuevo.</p>}
      </ActionForm>
    </section>
  );
}

function SetupCertificate({ connection }: { connection: ArcaConnection }) {
  return (
    <div className="space-y-6">
      <Intro />
      <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <h3 className="font-semibold">2. Tu certificado digital</h3>
        <p className="text-sm text-muted">
          CUIT {formatCuit(connection.cuit)} · punto de venta {connection.pointOfSale} · {ENV_LABEL[connection.environment]}
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            <a href="/panel/facturacion/pedido" download className="font-medium text-brand hover:underline">
              Descargá el pedido de certificado
            </a>
            . La clave privada queda guardada cifrada en la plataforma y nunca sale de acá.
          </li>
          <li>
            En ARCA, entrá a <strong>Administración de Certificados Digitales</strong>, agregá un alias (por ejemplo
            &quot;orgatodo&quot;), subí el pedido y descargá el certificado.
          </li>
          <li>
            En el <strong>Administrador de Relaciones de Clave Fiscal</strong>, asociá ese certificado a dos servicios:{" "}
            <strong>Facturación electrónica</strong> (wsfe) y <strong>Consulta de constancia de inscripción</strong>{" "}
            (ws_sr_constancia_inscripcion).
          </li>
          <li>Subí acá el certificado. Probamos la conexión y leemos tu categoría.</li>
        </ol>
        {connection.lastError && <p className="rounded-lg bg-red-50 p-3 text-sm text-danger dark:bg-red-950">{connection.lastError}</p>}
        <ActionForm action={uploadCertificateAction} submitLabel="Subir y probar" pendingLabel="Probando la conexión...">
          <label className="block text-sm">
            Archivo del certificado (.crt o .pem)
            <input type="file" name="certificate" accept=".crt,.pem,.cer,text/plain" className={inputClass} />
          </label>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">O pegá el contenido</summary>
            <textarea name="certificateText" rows={5} placeholder="-----BEGIN CERTIFICATE-----" className={`${inputClass} font-mono text-xs`} />
          </details>
        </ActionForm>
        {connection.certificatePem && (
          <ActionForm action={verifyConnectionAction} submitLabel="Volver a probar la conexión" pendingLabel="Probando...">
            <p className="text-sm text-muted">Si ya corregiste la relación en ARCA, probá de nuevo con el mismo certificado.</p>
          </ActionForm>
        )}
        {connection.environment === "simulado" && (
          <ActionForm action={applyTestCertificateAction} submitLabel="Usar un certificado de prueba">
            <p className="text-sm text-muted">Modo simulado: no se habla con ARCA y los comprobantes no tienen validez.</p>
          </ActionForm>
        )}
      </section>
      <details>
        <summary className="cursor-pointer text-sm text-muted">Cambiar CUIT o punto de venta</summary>
        <div className="mt-3">
          <StepOne connection={connection} />
        </div>
      </details>
    </div>
  );
}

async function Connected({
  connection,
  professionalId,
  timezone,
  issuedId,
}: {
  connection: ArcaConnection;
  professionalId: string;
  timezone: string;
  issuedId: string | null;
}) {
  const liveInvoice = db
    .select({ one: sql`1` })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.bookingId, schema.bookings.id),
        eq(schema.invoices.type, "factura_c"),
        inArray(schema.invoices.status, ["emitiendo", "emitida"]),
      ),
    );

  const [toInvoice, invoices] = await Promise.all([
    db
      .select({ booking: schema.bookings, client: schema.clients })
      .from(schema.bookings)
      .innerJoin(schema.clients, eq(schema.bookings.clientId, schema.clients.id))
      .where(and(eq(schema.bookings.professionalId, professionalId), eq(schema.bookings.status, "realizado"), notExists(liveInvoice)))
      .orderBy(desc(schema.bookings.startsAt))
      .limit(20),
    db
      .select()
      .from(schema.invoices)
      .where(and(eq(schema.invoices.professionalId, professionalId), eq(schema.invoices.environment, connection.environment)))
      .orderBy(desc(schema.invoices.createdAt))
      .limit(50),
  ]);

  const issued = issuedId ? invoices.find((i) => i.id === issuedId && i.status === "emitida") : undefined;
  const now = new Date();
  const today = toLocalDate(now, timezone);
  const certDaysLeft = connection.certificateExpiresAt
    ? Math.floor((connection.certificateExpiresAt.getTime() - now.getTime()) / 86_400_000)
    : null;

  return (
    <div className="space-y-8">
      {issued && (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand bg-brand-soft p-3 text-sm text-brand">
          <span>
            {INVOICE_TYPE_LABEL[issued.type]} {voucherNumber(issued)} emitida por {formatPrice(issued.amountCents)}
            {issued.recipientEmail && `. Se la mandamos a ${issued.recipientEmail}`}.
          </span>
          <Link href={`/factura/${issued.publicToken}`} target="_blank" className="font-semibold hover:underline">
            Ver comprobante
          </Link>
        </p>
      )}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Conexión con ARCA</p>
          <p className="font-semibold">{connection.legalName ?? formatCuit(connection.cuit)}</p>
          <p className="text-sm text-muted">
            CUIT {formatCuit(connection.cuit)} · punto de venta {connection.pointOfSale}
          </p>
          <p className="text-sm text-muted">{ENV_LABEL[connection.environment]}</p>
          {certDaysLeft !== null && (
            <p className={`text-sm ${certDaysLeft <= 30 ? "text-danger" : "text-muted"}`}>
              Certificado vence en {certDaysLeft} días
              {certDaysLeft <= 30 && ": generá uno nuevo desde \"Cambiar CUIT o punto de venta\"."}
            </p>
          )}
        </div>
        <div className="space-y-1 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Categoría de monotributo</p>
          <p className="text-2xl font-bold">{connection.monotributoCategory ?? "Sin dato"}</p>
          <p className="text-sm text-muted">
            {connection.monotributoCategoryDescription ?? "ARCA no informó la categoría"}
            {connection.categoryCheckedAt && ` · consultada el ${formatLongDate(connection.categoryCheckedAt, timezone)}`}
          </p>
          <Link href="/panel/resumen" className="text-sm font-medium text-brand hover:underline">
            Ver facturado contra el límite
          </Link>
        </div>
      </section>

      {connection.lastError && <p className="rounded-lg bg-red-50 p-3 text-sm text-danger dark:bg-red-950">{connection.lastError}</p>}
      <div className="flex flex-wrap gap-3">
        <ActionForm action={refreshCategoryAction} submitLabel="Actualizar categoría" pendingLabel="Consultando..." className="space-y-2" />
        <ActionForm action={verifyConnectionAction} submitLabel="Probar conexión" pendingLabel="Probando..." className="space-y-2" />
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Turnos para facturar</h2>
            <p className="text-sm text-muted">Turnos realizados que todavía no tienen factura, del más reciente al más viejo.</p>
          </div>
          {toInvoice.length === 0 ? (
            <p className="text-muted">No hay turnos realizados sin facturar.</p>
          ) : (
            <ul className="space-y-2">
              {toInvoice.map(({ booking, client }) => (
                <li key={booking.id} className="rounded-xl border border-border bg-surface p-3">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          {client.name} · {formatPrice(booking.priceCents)}
                        </span>
                        <span className="block text-sm text-muted">
                          {capitalize(formatLongDate(booking.startsAt, timezone))} · {booking.serviceName}
                        </span>
                      </span>
                      <span className="rounded-lg border border-border px-2.5 py-1 text-sm font-medium">Facturar</span>
                    </summary>
                    <div className="mt-3 border-t border-border pt-3">
                      <ActionForm action={invoiceBookingAction} submitLabel="Emitir factura C" pendingLabel="Pidiendo el CAE...">
                        <InvoiceFields bookingId={booking.id} defaultDni={client.documentNumber} hasEmail={Boolean(client.email)} />
                      </ActionForm>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Comprobantes</h2>
          {invoices.length === 0 ? (
            <p className="text-muted">Todavía no emitiste comprobantes.</p>
          ) : (
            <ul className="space-y-2">
              {invoices.map((inv) => {
                const chip = formatDayChip(inv.issueDate);
                return (
                  <li key={inv.id} className="space-y-2 rounded-xl border border-border bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {INVOICE_TYPE_LABEL[inv.type]} {inv.number ? voucherNumber(inv) : ""} · {formatPrice(inv.amountCents)}
                        </p>
                        <p className="text-sm text-muted">
                          {chip.weekday} {chip.day} {chip.month} · {inv.recipientName} · {inv.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <InvoiceStatus status={inv.status} />
                        {(inv.status === "emitida" || inv.status === "anulada") && (
                          <Link href={`/factura/${inv.publicToken}`} className="font-medium text-brand hover:underline" target="_blank">
                            Ver
                          </Link>
                        )}
                      </div>
                    </div>
                    {inv.arcaMessages && inv.status !== "emitida" && <p className="text-sm text-danger">{inv.arcaMessages}</p>}
                    {inv.status === "emitiendo" && (
                      <ActionForm action={retryInvoiceAction} submitLabel="Reintentar" pendingLabel="Consultando a ARCA...">
                        <input type="hidden" name="invoiceId" value={inv.id} />
                      </ActionForm>
                    )}
                    {inv.status === "emitida" && inv.type === "factura_c" && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted">Anular con nota de crédito</summary>
                        <div className="mt-2">
                          <ActionForm action={creditInvoiceAction} submitLabel="Emitir nota de crédito C" pendingLabel="Pidiendo el CAE...">
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <p className="text-muted">
                              Se emite una nota de crédito por {formatPrice(inv.amountCents)} que anula esta factura. El turno vuelve a
                              quedar para facturar.
                            </p>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Datos que van impresos en el comprobante</h2>
          <p className="text-sm text-muted">ARCA no los informa por web service; completalos si corresponden.</p>
        </div>
        <ActionForm action={saveLegendsAction} submitLabel="Guardar datos">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Ingresos Brutos
              <input name="grossIncomeNumber" defaultValue={connection.grossIncomeNumber ?? ""} placeholder="Exento, CM o número" className={inputClass} />
            </label>
            <label className="block text-sm">
              Inicio de actividades
              <input type="date" name="activityStartDate" max={today} defaultValue={connection.activityStartDate ?? ""} className={inputClass} />
            </label>
          </div>
        </ActionForm>
      </section>

      <details>
        <summary className="cursor-pointer text-sm text-muted">Cambiar CUIT o punto de venta</summary>
        <div className="mt-3">
          <StepOne connection={connection} />
        </div>
      </details>
      {arcaMode() !== connection.environment && (
        <p className="text-sm text-danger">
          Esta conexión es de {ENV_LABEL[connection.environment]}, pero la plataforma está en {ENV_LABEL[arcaMode()]}. Generá un pedido nuevo.
        </p>
      )}
    </div>
  );
}

function InvoiceStatus({ status }: { status: "emitiendo" | "emitida" | "rechazada" | "anulada" }) {
  const styles = {
    emitida: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    emitiendo: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    rechazada: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    anulada: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  } as const;
  const labels = { emitida: "Emitida", emitiendo: "Pendiente", rechazada: "Rechazada", anulada: "Anulada" } as const;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>{labels[status]}</span>;
}
