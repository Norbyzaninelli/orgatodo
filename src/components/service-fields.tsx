import type { Service } from "@/db/schema";
import { inputClass } from "@/lib/form-state";
import { centsToInput } from "@/lib/time";

/** Campos del formulario de servicio, para alta y edición. */
export function ServiceFields({ service }: { service?: Service }) {
  return (
    <>
      {service && <input type="hidden" name="id" value={service.id} />}
      <label className="block text-sm">
        Nombre
        <input name="name" required defaultValue={service?.name} placeholder="Sesión de kinesiología" className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Duración (minutos)
          <input
            name="durationMinutes"
            type="number"
            min={5}
            max={720}
            step={5}
            required
            defaultValue={service?.durationMinutes ?? 60}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          Precio ($)
          <input
            name="price"
            inputMode="decimal"
            required
            defaultValue={service ? centsToInput(service.priceCents) : ""}
            placeholder="25000"
            className={inputClass}
          />
        </label>
      </div>
      <label className="block text-sm">
        Modalidad
        <select name="modality" defaultValue={service?.modality ?? "presencial"} className={inputClass}>
          <option value="presencial">Presencial</option>
          <option value="virtual">Virtual</option>
        </select>
      </label>
      <label className="block text-sm">
        Descripción (opcional)
        <textarea name="description" rows={2} maxLength={500} defaultValue={service?.description ?? ""} className={inputClass} />
      </label>
    </>
  );
}
