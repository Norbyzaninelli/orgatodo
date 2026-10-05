import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { requireProfessional } from "@/lib/auth";
import { inputClass } from "@/lib/form-state";
import { saveProfileAction, setPublishedAction } from "../actions";

export const metadata: Metadata = { title: "Perfil" };

const STEP_OPTIONS = [10, 15, 20, 30, 45, 60];
const NOTICE_OPTIONS = [
  [0, "Sin anticipación"],
  [60, "1 hora"],
  [120, "2 horas"],
  [240, "4 horas"],
  [720, "12 horas"],
  [1440, "1 día"],
  [2880, "2 días"],
] as const;

export default async function ProfilePage() {
  const pro = await requireProfessional();
  const noticeOptions = NOTICE_OPTIONS.some(([v]) => v === pro.minNoticeMinutes)
    ? NOTICE_OPTIONS
    : [...NOTICE_OPTIONS, [pro.minNoticeMinutes, `${pro.minNoticeMinutes} minutos`] as const];

  return (
    <div className="space-y-8">
      <ActionForm action={saveProfileAction} submitLabel="Guardar perfil" className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Lo que ven tus clientes</h2>
          <label className="block text-sm">
            Nombre
            <input name="displayName" required defaultValue={pro.displayName} className={inputClass} />
          </label>
          <label className="block text-sm">
            Presentación
            <textarea
              name="bio"
              rows={3}
              maxLength={600}
              defaultValue={pro.bio ?? ""}
              placeholder="Contá a qué te dedicás y cómo trabajás"
              className={inputClass}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Dirección del consultorio
              <input name="address" maxLength={200} defaultValue={pro.address ?? ""} className={inputClass} />
            </label>
            <label className="block text-sm">
              Teléfono
              <input name="phone" type="tel" maxLength={30} defaultValue={pro.phone ?? ""} className={inputClass} />
            </label>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Reglas de reserva</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Anticipación mínima para reservar
              <select name="minNoticeMinutes" defaultValue={pro.minNoticeMinutes} className={inputClass}>
                {noticeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Descanso entre turnos (minutos)
              <input
                name="bufferMinutes"
                type="number"
                min={0}
                max={240}
                step={5}
                defaultValue={pro.bufferMinutes}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              Ofrecer horarios cada
              <select name="slotStepMinutes" defaultValue={pro.slotStepMinutes} className={inputClass}>
                {STEP_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} minutos
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Se puede reservar hasta (días)
              <input
                name="maxDaysAhead"
                type="number"
                min={1}
                max={365}
                defaultValue={pro.maxDaysAhead}
                className={inputClass}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input name="autoConfirm" type="checkbox" defaultChecked={pro.autoConfirm} className="accent-[var(--brand)]" />
            Confirmar los turnos automáticamente
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="worksOnHolidays"
              type="checkbox"
              defaultChecked={pro.worksOnHolidays}
              className="accent-[var(--brand)]"
            />
            Atiendo los feriados
          </label>
        </section>
      </ActionForm>

      <section className="space-y-2 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold">Tu página</h2>
        <p className="text-sm text-muted">
          orgatodo.com/{pro.slug} {pro.published ? "está publicada." : "todavía no está publicada."}
        </p>
        <form action={setPublishedAction}>
          <input type="hidden" name="published" value={String(!pro.published)} />
          <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:border-brand">
            {pro.published ? "Despublicar" : "Publicar"}
          </button>
        </form>
      </section>
    </div>
  );
}
