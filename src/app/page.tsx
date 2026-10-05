import Link from "next/link";
import { SearchForm } from "@/components/search-form";

const POPULAR = [
  ["kinesiologia", "Kinesiología"],
  ["psicologia", "Psicología"],
  ["nutricion", "Nutrición"],
  ["peluqueria", "Peluquería"],
  ["barberia", "Barbería"],
  ["unas", "Uñas"],
  ["estetica", "Estética"],
  ["masajes", "Masajes"],
] as const;

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-14 py-6 sm:py-10">
      <section className="space-y-5">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Sacá turno online <span className="text-brand">con profesionales cerca tuyo.</span>
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Buscá por servicio y zona, elegí día y horario, y listo. Te llega la confirmación y un recordatorio.
        </p>
        <SearchForm />
        <nav aria-label="Rubros" className="flex flex-wrap gap-2">
          {POPULAR.map(([key, label]) => (
            <Link
              key={key}
              href={`/buscar?rubro=${key}`}
              className="rounded-full border border-border px-3 py-1 text-sm font-medium transition hover:border-brand"
            >
              {label}
            </Link>
          ))}
        </nav>
      </section>

      <section className="space-y-5 rounded-2xl border border-border bg-surface p-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">¿Sos profesional o tenés un centro?</p>
          <h2 className="text-2xl font-bold tracking-tight">Tus turnos y tu facturación, en un solo lugar.</h2>
          <p className="max-w-xl text-muted">
            Publicás tus servicios, tus clientes reservan online, reciben recordatorios y vos facturás cada turno con
            ARCA sin salir de la app.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            ["Agenda online", "Tus clientes eligen día y horario desde tu página o el buscador."],
            ["Recordatorios", "Avisos automáticos para que nadie se olvide del turno."],
            ["Factura electrónica", "Emitís la factura C de cada turno con tu CUIT."],
          ].map(([title, text]) => (
            <li key={title} className="rounded-xl border border-border bg-background p-4">
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Link href="/registro" className="rounded-lg bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand-strong">
            Crear mi cuenta
          </Link>
          <Link href="/ingresar" className="rounded-lg border border-border px-5 py-3 font-semibold transition hover:border-brand">
            Ingresar
          </Link>
        </div>
      </section>
    </div>
  );
}
