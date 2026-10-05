import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireProfessional } from "@/lib/auth";
import { addDays, localToInstant, toLocalDate } from "@/lib/agenda/slots";
import { getOrganization, listMembers } from "@/lib/centros";
import { formatLongDate, formatPrice, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Agenda del equipo" };

const STATUS_LABEL = {
  reservado: "A confirmar",
  confirmado: "Confirmado",
  realizado: "Realizado",
  ausente: "No vino",
  cancelado: "Cancelado",
} as const;

export default async function TeamAgendaPage(props: PageProps<"/panel/centro/agenda">) {
  const pro = await requireProfessional();
  const org = await getOrganization(pro.organizationId);
  if (org.kind !== "centro" || !pro.isAdmin) redirect("/panel/centro");

  const tz = pro.timezone;
  const today = toLocalDate(new Date(), tz);
  const { dia } = await props.searchParams;
  const day = typeof dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : today;

  const members = await listMembers(org.id);
  const rows =
    members.length === 0
      ? []
      : await db
          .select({ booking: schema.bookings, client: schema.clients })
          .from(schema.bookings)
          .innerJoin(schema.clients, eq(schema.bookings.clientId, schema.clients.id))
          .where(
            and(
              inArray(
                schema.bookings.professionalId,
                members.map((m) => m.id),
              ),
              gte(schema.bookings.startsAt, localToInstant(day, 0, tz)),
              lt(schema.bookings.startsAt, localToInstant(addDays(day, 1), 0, tz)),
            ),
          )
          .orderBy(asc(schema.bookings.startsAt));

  const active = rows.filter((r) => r.booking.status !== "cancelado");
  const label = day === today ? "Hoy" : formatLongDate(localToInstant(day, 720, tz), tz);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/panel/centro" className="text-sm text-muted hover:text-foreground">
            ← {org.name}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Agenda del equipo</h1>
        </div>
        <nav className="flex items-center gap-2">
          <Link href={`/panel/centro/agenda?dia=${addDays(day, -1)}`} aria-label="Día anterior" className="rounded-lg border border-border px-3 py-1.5 hover:border-brand">
            ←
          </Link>
          <Link href="/panel/centro/agenda" className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-brand">
            Hoy
          </Link>
          <Link href={`/panel/centro/agenda?dia=${addDays(day, 1)}`} aria-label="Día siguiente" className="rounded-lg border border-border px-3 py-1.5 hover:border-brand">
            →
          </Link>
        </nav>
      </div>

      <p className="text-lg font-semibold">
        <span className="capitalize">{label}</span> · <span className="font-normal text-muted">{active.length === 1 ? "1 turno" : `${active.length} turnos`}</span>
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => {
          const own = rows.filter((r) => r.booking.professionalId === member.id);
          return (
            <section key={member.id} className="space-y-2 rounded-xl border border-border bg-surface p-3">
              <h2 className="font-semibold">{member.displayName}</h2>
              {own.length === 0 ? (
                <p className="text-sm text-muted">Sin turnos</p>
              ) : (
                <ul className="space-y-2">
                  {own.map(({ booking, client }) => (
                    <li
                      key={booking.id}
                      className={[
                        "rounded-lg border border-border bg-background p-2 text-sm",
                        booking.status === "cancelado" ? "opacity-50" : "",
                      ].join(" ")}
                    >
                      <p className="font-medium">
                        {formatTime(booking.startsAt, tz)}–{formatTime(booking.endsAt, tz)} · {client.name}
                      </p>
                      <p className="text-muted">
                        {booking.serviceName} · {formatPrice(booking.priceCents)} · {STATUS_LABEL[booking.status]}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
