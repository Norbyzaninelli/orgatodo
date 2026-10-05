import { rubrosByGroup } from "@/lib/rubros";

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-brand";

/** Formulario del buscador; manda por GET a /buscar para que el link se pueda compartir. */
export function SearchForm({ q, rubro, zona }: { q?: string; rubro?: string; zona?: string }) {
  return (
    <form action="/buscar" className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
      <label className="sr-only" htmlFor="buscar-q">
        Qué buscás
      </label>
      <input id="buscar-q" name="q" defaultValue={q} placeholder="Servicio o nombre" className={field} />
      <label className="sr-only" htmlFor="buscar-rubro">
        Rubro
      </label>
      <select id="buscar-rubro" name="rubro" defaultValue={rubro ?? ""} className={field}>
        <option value="">Todos los rubros</option>
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
      <label className="sr-only" htmlFor="buscar-zona">
        Zona
      </label>
      <input id="buscar-zona" name="zona" defaultValue={zona} placeholder="Barrio, ciudad o provincia" className={field} />
      <button type="submit" className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white transition hover:bg-brand-strong">
        Buscar
      </button>
    </form>
  );
}
