import type { Metadata } from "next";
import { and, asc, eq, gte } from "drizzle-orm";
import { ActionForm } from "@/components/action-form";
import { ScheduleEditor } from "@/components/schedule-editor";
import { db, schema } from "@/db";
import { requireProfessional } from "@/lib/auth";
import { toLocalDate } from "@/lib/agenda/slots";
import { formatDayChip } from "@/lib/format";
import { inputClass } from "@/lib/form-state";
import { minutesToTime } from "@/lib/time";
import { addExceptionAction, deleteExceptionAction, saveScheduleAction } from "../actions";

export const metadata: Metadata = { title: "Horarios" };

export default async function SchedulePage() {
  const pro = await requireProfessional();
  const today = toLocalDate(new Date(), pro.timezone);
  const [rules, exceptions] = await Promise.all([
    db
      .select()
      .from(schema.availabilityRules)
      .where(eq(schema.availabilityRules.professionalId, pro.id))
      .orderBy(asc(schema.availabilityRules.weekday), asc(schema.availabilityRules.startMinute)),
    db
      .select()
      .from(schema.availabilityExceptions)
      .where(
        and(eq(schema.availabilityExceptions.professionalId, pro.id), gte(schema.availabilityExceptions.date, today)),
      )
      .orderBy(asc(schema.availabilityExceptions.date), asc(schema.availabilityExceptions.startMinute)),
  ]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Horario semanal</h2>
          <p className="text-sm text-muted">Tus clientes solo pueden reservar dentro de estos horarios.</p>
        </div>
        <ScheduleEditor
          action={saveScheduleAction}
          initial={rules.map((r) => ({
            weekday: r.weekday,
            start: minutesToTime(r.startMinute),
            end: minutesToTime(r.endMinute),
          }))}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Días u horas bloqueadas</h2>
          <p className="text-sm text-muted">Vacaciones, trámites o cualquier momento en que no atendés.</p>
        </div>
        {exceptions.length > 0 && (
          <ul className="space-y-2">
            {exceptions.map((ex) => {
              const chip = formatDayChip(ex.date);
              return (
                <li key={ex.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                  <p>
                    <span className="font-semibold capitalize">
                      {chip.weekday} {chip.day} {chip.month}
                    </span>
                    <span className="text-muted">
                      {" · "}
                      {ex.startMinute === null || ex.endMinute === null
                        ? "Todo el día"
                        : `${minutesToTime(ex.startMinute)} a ${minutesToTime(ex.endMinute)}`}
                      {ex.reason && ` · ${ex.reason}`}
                    </span>
                  </p>
                  <form action={deleteExceptionAction}>
                    <input type="hidden" name="exceptionId" value={ex.id} />
                    <button type="submit" className="text-sm font-medium text-muted hover:text-danger">
                      Quitar
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <div className="rounded-xl border border-border bg-surface p-4">
          <ActionForm action={addExceptionAction} submitLabel="Bloquear" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                Fecha
                <input name="date" type="date" min={today} required className={inputClass} />
              </label>
              <label className="block text-sm">
                Desde
                <input name="start" type="time" className={inputClass} />
              </label>
              <label className="block text-sm">
                Hasta
                <input name="end" type="time" className={inputClass} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="allDay" type="checkbox" className="accent-[var(--brand)]" /> Todo el día
            </label>
            <label className="block text-sm">
              Motivo (opcional, no lo ven tus clientes)
              <input name="reason" maxLength={120} className={inputClass} />
            </label>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
