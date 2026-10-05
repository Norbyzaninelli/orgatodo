import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { ActionForm } from "@/components/action-form";
import { db, schema } from "@/db";
import { requireProfessional } from "@/lib/auth";
import { toLocalDate } from "@/lib/agenda/slots";
import { manageableProfessionals } from "@/lib/equipo";
import { inputClass } from "@/lib/form-state";
import { formatDuration, formatPrice } from "@/lib/format";
import { createManualBookingAction } from "../../actions";

export const metadata: Metadata = { title: "Cargar turno" };

export default async function NewBookingPage(props: PageProps<"/panel/turnos/nuevo">) {
  const actor = await requireProfessional();
  const { profesional, dia, volver } = await props.searchParams;
  const team = await manageableProfessionals(actor);
  const services = await db
    .select()
    .from(schema.services)
    .where(
      and(
        inArray(
          schema.services.professionalId,
          team.map((p) => p.id),
        ),
        eq(schema.services.active, true),
      ),
    )
    .orderBy(asc(schema.services.position), asc(schema.services.name));

  // El propio primero; con equipo, cada profesional es un grupo del select.
  const groups = [actor, ...team.filter((p) => p.id !== actor.id).sort((a, b) => a.displayName.localeCompare(b.displayName))]
    .map((pro) => ({ pro, services: services.filter((s) => s.professionalId === pro.id) }))
    .filter((g) => g.services.length > 0);
  const preferred = groups.find((g) => g.pro.id === profesional) ?? groups[0];
  const today = toLocalDate(new Date(), actor.timezone);
  const backToTeam = volver === "equipo";

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-1">
        <Link href={backToTeam ? "/panel/centro/agenda" : "/panel"} className="text-sm text-muted hover:text-foreground">
          ← {backToTeam ? "Agenda del equipo" : "Mis turnos"}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Cargar un turno</h1>
        <p className="text-muted">Para los turnos que te piden por WhatsApp, por teléfono o en persona.</p>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-4">
          Primero cargá un servicio en{" "}
          <Link href="/panel/servicios" className="font-medium text-brand hover:underline">
            Servicios
          </Link>
          .
        </p>
      ) : (
        <ActionForm action={createManualBookingAction} submitLabel="Guardar turno" className="space-y-4">
          {backToTeam && <input type="hidden" name="volver" value="equipo" />}
          <label className="block text-sm">
            {groups.length > 1 ? "Profesional y servicio" : "Servicio"}
            <select
              name="servicio"
              required
              defaultValue={`${preferred.pro.id}:${preferred.services[0].id}`}
              className={inputClass}
            >
              {groups.map(({ pro, services }) =>
                groups.length > 1 ? (
                  <optgroup key={pro.id} label={pro.displayName}>
                    {services.map((s) => (
                      <ServiceOption key={s.id} proId={pro.id} service={s} />
                    ))}
                  </optgroup>
                ) : (
                  services.map((s) => <ServiceOption key={s.id} proId={pro.id} service={s} />)
                ),
              )}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Día
              <input
                name="date"
                type="date"
                required
                defaultValue={typeof dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : today}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              Hora
              <input name="time" type="time" required step={300} className={inputClass} />
            </label>
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold uppercase tracking-wide text-muted">Cliente</legend>
            <label className="block text-sm">
              Nombre y apellido
              <input name="name" required maxLength={120} className={inputClass} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                Celular (WhatsApp)
                <input name="phone" type="tel" maxLength={30} className={inputClass} />
              </label>
              <label className="block text-sm">
                Email (opcional)
                <input name="email" type="email" className={inputClass} />
              </label>
            </div>
            <label className="block text-sm">
              Nota (opcional)
              <textarea name="notes" rows={2} maxLength={500} className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="notifyClient" type="checkbox" defaultChecked className="accent-[var(--brand)]" />
              Mandarle la confirmación y el recordatorio
            </label>
          </fieldset>
        </ActionForm>
      )}
    </div>
  );
}

function ServiceOption({ proId, service }: { proId: string; service: typeof schema.services.$inferSelect }) {
  return (
    <option value={`${proId}:${service.id}`}>
      {service.name} · {formatDuration(service.durationMinutes)} · {formatPrice(service.priceCents)}
    </option>
  );
}
