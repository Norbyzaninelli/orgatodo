import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { ActionForm } from "@/components/action-form";
import { categoryLimitCents } from "@/lib/arca/categorias";
import { getConnection } from "@/lib/arca/connection";
import { netInvoicedCents } from "@/lib/arca/qr";
import { db, schema } from "@/db";
import { requireProfessional } from "@/lib/auth";
import { localToInstant, toLocalDate } from "@/lib/agenda/slots";
import { capitalize, formatDayChip, formatLongDate, formatPrice, plural } from "@/lib/format";
import { inputClass } from "@/lib/form-state";
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  addMonths,
  capProgress,
  formatMonth,
  formatMonthShort,
  isValidMonth,
  monthBounds,
  monthOf,
  monthsEndingAt,
  summarizeByMonth,
  type ExpenseCategory,
} from "@/lib/resumen";
import { addExpenseAction, deleteExpenseAction, setPaidAction } from "../actions";

export const metadata: Metadata = { title: "Resumen" };

export default async function SummaryPage({ searchParams }: PageProps<"/panel/resumen">) {
  const pro = await requireProfessional();
  const tz = pro.timezone;
  const today = toLocalDate(new Date(), tz);
  const currentMonth = monthOf(today);
  const { mes } = await searchParams;
  const month = isValidMonth(mes) && mes <= currentMonth ? mes : currentMonth;

  // Los últimos 12 meses hasta el elegido: alcanzan para el gráfico y para el tope de la categoría.
  const months = monthsEndingAt(month, 12);
  const from = monthBounds(months[0]).first;
  const to = monthBounds(month).next;

  const connection = await getConnection(pro.id);
  const [done, expenses, unpaid, issuedInvoices] = await Promise.all([
    db
      .select({ startsAt: schema.bookings.startsAt, priceCents: schema.bookings.priceCents, paidAt: schema.bookings.paidAt })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.professionalId, pro.id),
          eq(schema.bookings.status, "realizado"),
          gte(schema.bookings.startsAt, localToInstant(from, 0, tz)),
          lt(schema.bookings.startsAt, localToInstant(to, 0, tz)),
        ),
      ),
    db
      .select()
      .from(schema.expenses)
      .where(and(eq(schema.expenses.professionalId, pro.id), gte(schema.expenses.date, from), lt(schema.expenses.date, to)))
      .orderBy(desc(schema.expenses.date), desc(schema.expenses.createdAt)),
    db
      .select({ booking: schema.bookings, clientName: schema.clients.name })
      .from(schema.bookings)
      .innerJoin(schema.clients, eq(schema.bookings.clientId, schema.clients.id))
      .where(
        and(
          eq(schema.bookings.professionalId, pro.id),
          eq(schema.bookings.status, "realizado"),
          isNull(schema.bookings.paidAt),
        ),
      )
      .orderBy(asc(schema.bookings.startsAt))
      .limit(50),
    connection
      ? db
          .select({ type: schema.invoices.type, status: schema.invoices.status, amountCents: schema.invoices.amountCents })
          .from(schema.invoices)
          .where(
            and(
              eq(schema.invoices.professionalId, pro.id),
              eq(schema.invoices.environment, connection.environment),
              gte(schema.invoices.issueDate, from),
              lt(schema.invoices.issueDate, to),
            ),
          )
      : Promise.resolve([]),
  ]);

  const summary = summarizeByMonth(
    months,
    done.map((b) => ({ date: toLocalDate(b.startsAt, tz), priceCents: b.priceCents, paid: b.paidAt !== null })),
    expenses.map((e) => ({ date: e.date, category: e.category, amountCents: e.amountCents })),
  );
  const current = summary.get(month)!;
  const monthExpenses = expenses.filter((e) => monthOf(e.date) === month);
  const invoiced12 = netInvoicedCents(issuedInvoices);
  const limit = categoryLimitCents(connection?.monotributoCategory ?? null, to);
  const cap = connection?.verifiedAt ? capProgress(invoiced12, limit) : null;
  const chart = months.slice(-6).map((m) => summary.get(m)!);
  const chartMax = Math.max(1, ...chart.map((s) => Math.max(s.incomeCents, s.expensesCents)));
  const defaultExpenseDate = month === currentMonth ? today : monthBounds(month).first;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/panel/resumen?mes=${addMonths(month, -1)}`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-brand"
          aria-label="Mes anterior"
        >
          ←
        </Link>
        <h2 className="text-lg font-bold">{capitalize(formatMonth(month))}</h2>
        {month < currentMonth ? (
          <Link
            href={`/panel/resumen?mes=${addMonths(month, 1)}`}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-brand"
            aria-label="Mes siguiente"
          >
            →
          </Link>
        ) : (
          <span className="w-10" />
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ingresos" value={formatPrice(current.incomeCents)} hint={plural(current.sessions, "turno realizado", "turnos realizados")} />
        <Stat label="Cobrado" value={formatPrice(current.paidCents)} hint={current.unpaidCents > 0 ? `Falta cobrar ${formatPrice(current.unpaidCents)}` : "Todo cobrado"} />
        <Stat label="Gastos" value={formatPrice(current.expensesCents)} hint={plural(monthExpenses.length, "gasto cargado", "gastos cargados")} />
        <Stat
          label="Resultado"
          value={formatPrice(current.resultCents)}
          hint="Ingresos menos gastos"
          tone={current.resultCents < 0 ? "danger" : "brand"}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Últimos 6 meses</h2>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex h-40 items-end gap-3">
            {chart.map((s) => (
              <Link
                key={s.month}
                href={`/panel/resumen?mes=${s.month}`}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
                title={`${formatMonth(s.month)}: ingresos ${formatPrice(s.incomeCents)}, gastos ${formatPrice(s.expensesCents)}`}
              >
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div
                    className="w-1/2 max-w-6 rounded-t bg-brand"
                    style={{ height: `${(s.incomeCents / chartMax) * 100}%` }}
                  />
                  <div
                    className="w-1/2 max-w-6 rounded-t bg-zinc-300 dark:bg-zinc-600"
                    style={{ height: `${(s.expensesCents / chartMax) * 100}%` }}
                  />
                </div>
                <span
                  className={`text-xs capitalize ${s.month === month ? "font-semibold text-foreground" : "text-muted group-hover:text-foreground"}`}
                >
                  {formatMonthShort(s.month)}
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" /> Ingresos
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-zinc-300 dark:bg-zinc-600" /> Gastos
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Categoría del monotributo</h2>
          {!connection?.verifiedAt ? (
            <p className="text-sm text-muted">
              <Link href="/panel/facturacion" className="font-medium text-brand hover:underline">
                Conectá tu facturación
              </Link>{" "}
              y leemos tu categoría de ARCA para avisarte cuánto llevás facturado contra su límite.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Categoría <strong className="text-foreground">{connection.monotributoCategory ?? "sin dato"}</strong> · facturado en los
              últimos 12 meses hasta {formatMonth(month)}: <strong className="text-foreground">{formatPrice(invoiced12)}</strong>
            </p>
          )}
        </div>
        {cap && (
          <div className="space-y-1">
            <div className="h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full ${cap.level === "ok" ? "bg-brand" : cap.level === "cerca" ? "bg-amber-500" : "bg-danger"}`}
                style={{ width: `${Math.min(100, cap.ratio * 100)}%` }}
              />
            </div>
            <p className={`text-sm ${cap.level === "excedido" ? "text-danger" : "text-muted"}`}>
              {Math.round(cap.ratio * 100)}% del límite de la categoría {connection?.monotributoCategory}, {formatPrice(cap.capCents)}
              {cap.level === "cerca" && ". Estás cerca del límite."}
              {cap.level === "excedido" && ". Superaste el límite de tu categoría: consultá con tu contador."}
            </p>
          </div>
        )}
        {connection?.verifiedAt && connection.monotributoCategory && !cap && (
          <p className="text-xs text-muted">Todavía no cargamos la tabla de límites vigente de ARCA.</p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Turnos sin cobrar</h2>
          <p className="text-sm text-muted">Marcá cada turno realizado cuando te lo paguen.</p>
        </div>
        {unpaid.length === 0 ? (
          <p className="text-muted">No tenés turnos pendientes de cobro.</p>
        ) : (
          <ul className="space-y-2">
            {unpaid.map(({ booking, clientName }) => (
              <li key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {clientName} · {formatPrice(booking.priceCents)}
                  </p>
                  <p className="text-sm text-muted">
                    {capitalize(formatLongDate(booking.startsAt, tz))} · {booking.serviceName}
                  </p>
                </div>
                <form action={setPaidAction} className="flex items-center gap-2">
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <select
                    name="paymentMethod"
                    aria-label="Medio de pago"
                    defaultValue="efectivo"
                    className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                  >
                    {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-sm font-medium transition hover:border-brand">
                    Cobrado
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Gastos de {formatMonth(month)}</h2>
        {current.expensesCents > 0 && (
          <ul className="flex flex-wrap gap-2 text-sm">
            {(Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[])
              .filter((c) => current.byCategory[c] > 0)
              .map((c) => (
                <li key={c} className="rounded-full bg-brand-soft px-3 py-1 text-brand">
                  {EXPENSE_CATEGORIES[c]}: {formatPrice(current.byCategory[c])}
                </li>
              ))}
          </ul>
        )}
        {monthExpenses.length > 0 && (
          <ul className="space-y-2">
            {monthExpenses.map((e) => {
              const chip = formatDayChip(e.date);
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {formatPrice(e.amountCents)} · {EXPENSE_CATEGORIES[e.category]}
                    </p>
                    <p className="text-sm text-muted">
                      {chip.weekday} {chip.day} {chip.month}
                      {e.description && ` · ${e.description}`}
                    </p>
                  </div>
                  <form action={deleteExpenseAction}>
                    <input type="hidden" name="expenseId" value={e.id} />
                    <button type="submit" className="text-sm text-muted hover:text-danger">
                      Borrar
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <ActionForm action={addExpenseAction} submitLabel="Agregar gasto" resetOnSuccess className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              Fecha
              <input type="date" name="date" required defaultValue={defaultExpenseDate} max={today} className={inputClass} />
            </label>
            <label className="block text-sm">
              Categoría
              <select name="category" required defaultValue="insumos" className={inputClass}>
                {Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Monto ($)
              <input name="amount" required inputMode="decimal" placeholder="15000" className={inputClass} />
            </label>
          </div>
          <label className="block text-sm">
            Detalle (opcional)
            <input name="description" maxLength={200} placeholder="Por ejemplo: guantes y alcohol" className={inputClass} />
          </label>
        </ActionForm>
      </section>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "brand" | "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone === "danger" ? "text-danger" : tone === "brand" ? "text-brand" : ""}`}>{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}
