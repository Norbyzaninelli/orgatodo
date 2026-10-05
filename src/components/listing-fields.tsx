import { inputClass } from "@/lib/form-state";
import { PROVINCIAS, rubrosByGroup } from "@/lib/rubros";

/** Rubro y zona, para aparecer en el buscador. */
export function ListingFields({
  category,
  city,
  province,
}: {
  category: string | null;
  city: string | null;
  province: string | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block text-sm">
        Rubro
        <select name="category" defaultValue={category ?? ""} className={inputClass}>
          <option value="">Elegí uno</option>
          {rubrosByGroup().map(([group, rubros]) => (
            <optgroup key={group} label={group}>
              {rubros.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Localidad o barrio
        <input name="city" maxLength={80} defaultValue={city ?? ""} placeholder="Palermo" className={inputClass} />
      </label>
      <label className="block text-sm">
        Provincia
        <select name="province" defaultValue={province ?? ""} className={inputClass}>
          <option value="">Elegí una</option>
          {PROVINCIAS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
