import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireProfessional } from "@/lib/auth";
import { addDays, localToInstant, toLocalDate } from "@/lib/agenda/slots";
import { formatLongDate, formatPrice, formatTime } from "@/lib/format";
import { setBookingStatusAction, setPublishedAction } from "./actions";

export const metadata: Metadata = { title: "Mis turnos" };

const STATUS = {
  reservado: { label: "A confirmar", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  confirmado: { label: "Confirmado", className: "bg-brand-soft text-brand" },
  realizado: { label: "Realizado", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  ausente: { label: "Ausente", className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  cancelado: { label: "Cancelado", className: "bg-zinc-200 text-zinc-500 line-through dark:bg-zinc-800" },
} as const;

export default async function PanelHome() {
  const pro = await requireProfessional();
  const tz = pro.timezone;
  const now = new Date();
  const today = toLocalDate(now, tz);
  const from = localToInstant(addDays(today, -7), 0, tz);
  const to = localToInstant(addDays(today, 60), 0, tz);

  const [rows, [{ services }], [{ rules }]] = await Promise.all([
    db
      .select({ booking: schema.bookings, client: schema.clients })
      .from(schema.bookings)
      .innerJoin(schema.clients, eq(schema.bookings.clientId, schema.clients.id))
      .where(
        and(
          eq(schema.bookings.professionalId, pro.id),
          gte(schema.bookings.startsAt, from),
          lt(schema.bookings.startsAt, to),
        ),
      )
      .orderBy(asc(schema.bookings.startsAt)),
    db
      .select({ services: count() })
      .from(schema.services)
      .where(and(eq(schema.services.professionalId, pro.id), eq(schema.services.active, true))),
    db.select({ rules: count() }).from(schema.availabilityRules).where(eq(schema.availabilityRules.professionalId, pro.id)),
  ]);

  // Pasados que siguen abiertos: hay que marcar si se hicieron o no. Futuros: la agenda.
  const pending = rows.filter(
    (r) => r.booking.startsAt < now && (r.booking.status === "reservado" || r.booking.status === "confirmado"),
  );
  const upcoming = rows.filter((r) => r.booking.startsAt >= now);
  const byDay = new Map<string, typeof upcoming>();
  for (const row of upcoming) {
    const day = toLocalDate(row.booking.startsAt, tz);
    byDay.set(day, [...(byDay.get(day) ?? []), row]);
  }

  return (
    <div className="space-y-8">
      {!pro.published && (
        <section className="space-y-3 rounded-xl border border-brand bg-surface p-4">
          <h2 className="font-semibold">Primeros pasos para recibir turnos</h2>
          <ol className="space-y-2 text-sm">
            <Step done={services > 0} href="/panel/servicios" text="Cargá al menos un servicio con su precio y duración" />
            <Step done={rules > 0} href="/panel/horarios" text="Revisá tus horarios de atención" />
            <Step done={Boolean(pro.bio || pro.address)} href="/panel/perfil" text="Completá tu perfil" />
          </ol>
          <form action={setPublishedAction}>
            <input type="hidden" name="published" value="true" />
            <button
              type="submit"
              disabled={services === 0 || rules === 0}
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand-strong disabled:opacity-50"
            >
              Publicar mi página
            </button>
          </form>
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">¿Cómo salieron estos turnos?</h2>
          <ul className="space-y-2">
            {pending.map(({ booking, client }) => (
              <BookingRow key={booking.id} booking={booking} client={client} tz={tz} showDate past />
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Próximos turnos</h2>
        {byDay.size === 0 ? (
          <p className="text-muted">
            No tenés turnos próximos.
            {pro.published && (
              <>
                {" "}Compartí tu página:{" "}
                <Link href={`/${pro.slug}`} className="font-medium text-brand hover:underline">
                  orgatodo.com/{pro.slug}
                </Link>
              </>
            )}
          </p>
        ) : (
          [...byDay.entries()].map(([day, dayRows]) => (
            <div key={day} className="space-y-2">
              <h3 className="font-semibold capitalize">
                {day === today ? "Hoy" : formatLongDate(dayRows[0].booking.startsAt, tz)}
              </h3>
              <ul className="space-y-2">
                {dayRows.map(({ booking, client }) => (
                  <BookingRow key={booking.id} booking={booking} client={client} tz={tz} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Step({ done, href, text }: { done: boolean; href: string; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={done ? "text-brand" : "text-muted"}>{done ? "✓" : "○"}</span>
      <Link href={href} className={done ? "text-muted line-through" : "hover:underline"}>
        {text}
      </Link>
    </li>
  );
}

function BookingRow({
  booking,
  client,
  tz,
  showDate,
  past,
}: {
  booking: typeof schema.bookings.$inferSelect;
  client: typeof schema.clients.$inferSelect;
  tz: string;
  showDate?: boolean;
  past?: boolean;
}) {
  const status = STATUS[booking.status];
  const active = booking.status === "reservado" || booking.status === "confirmado";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
      <div className="min-w-0">
        <p className="font-semibold">
          {showDate && <span className="capitalize">{formatLongDate(booking.startsAt, tz)} · </span>}
          {formatTime(booking.startsAt, tz)} · {client.name}
        </p>
        <p className="text-sm text-muted">
          {booking.serviceName} · {formatPrice(booking.priceCents)}
          {client.phone && (
            <>
              {" · "}
              <a href={`https://wa.me/${client.phone.replace(/\D/g, "")}`} className="text-brand hover:underline">
                {client.phone}
              </a>
            </>
          )}
        </p>
        {booking.notes && <p className="mt-1 text-sm text-muted">“{booking.notes}”</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
        {active && past && (
          <>
            <StatusButton id={booking.id} status="realizado" label="Realizado" />
            <StatusButton id={booking.id} status="ausente" label="No vino" />
          </>
        )}
        {active && !past && booking.status === "reservado" && (
          <StatusButton id={booking.id} status="confirmado" label="Confirmar" />
        )}
        {active && !past && <StatusButton id={booking.id} status="cancelado" label="Cancelar" />}
      </div>
    </li>
  );
}

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={setBookingStatusAction}>
      <input type="hidden" name="bookingId" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="rounded-lg border border-border px-2.5 py-1 text-sm font-medium transition hover:border-brand"
      >
        {label}
      </button>
    </form>
  );
}
