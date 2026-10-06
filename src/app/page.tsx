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

// Es una secuencia real: lo que pasa con cada turno, de la reserva al resumen.
const RECORRIDO = [
  ["Reservan", "Tu cliente elige servicio, día y horario desde tu página o el buscador."],
  ["Les avisamos", "Confirmación al instante y recordatorio el día anterior, por WhatsApp o email."],
  ["Atendés", "Marcás el turno como realizado. Si alguien faltó, también queda registrado."],
  ["Facturás", "Emitís la factura C en ARCA con tu certificado y los datos del turno ya cargados."],
  ["Mirás tus números", "Ingresos, gastos y cuánto facturaste contra el tope de tu categoría."],
] as const;

/** Las secciones de color ocupan todo el ancho aunque el layout centre el contenido. */
const fullBleed = "mx-[calc(50%-50vw)]";

export default function Home() {
  return (
    <div className="-mt-8 -mb-8">
      <section className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div className="space-y-7">
          <h1 className="max-w-[14ch] font-serif text-[2.75rem] leading-[1.04] font-semibold tracking-tight sm:text-[4rem]">
            Tu agenda y tu monotributo, en orden.
          </h1>
          <p className="max-w-[44ch] text-lg leading-relaxed text-muted">
            Tus clientes sacan turno solos y les llega el recordatorio por WhatsApp. Vos facturás cada turno en ARCA sin
            cargar nada dos veces, y siempre sabés cuánto te queda para el tope de tu categoría.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/registro"
              className="rounded-full bg-brand px-7 py-3.5 font-semibold text-white transition-colors hover:bg-brand-strong"
            >
              Crear mi cuenta
            </Link>
            <Link
              href="/ingresar"
              className="rounded-full border border-border bg-surface px-7 py-3.5 font-medium transition-colors hover:border-brand"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>

        <DiaDeAgenda />
      </section>

      <section className="space-y-12 border-t border-border py-16 sm:py-20">
        <div className="max-w-2xl space-y-3">
          <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-[2.6rem]">Qué pasa con cada turno</h2>
          <p className="text-lg text-muted">
            Un mismo turno pasa por tu agenda, tu facturación y tu resumen. Lo cargás una sola vez.
          </p>
        </div>
        <ol className="relative grid gap-8 lg:grid-cols-5 lg:gap-6">
          <span aria-hidden="true" className="absolute top-5 bottom-5 left-5 w-px bg-border lg:top-5 lg:right-[10%] lg:bottom-auto lg:left-[10%] lg:h-px lg:w-auto" />
          {RECORRIDO.map(([titulo, texto], i) => (
            <li key={titulo} className="relative flex gap-5 lg:flex-col lg:items-center lg:text-center">
              <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand bg-background font-semibold text-brand tabular-nums">
                {i + 1}
              </span>
              <div className="space-y-1.5">
                <p className="font-serif text-xl font-semibold">{titulo}</p>
                <p className="max-w-[32ch] leading-relaxed text-muted">{texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-10 border-t border-border py-16 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="font-serif text-2xl font-semibold">¿Trabajás en un centro?</h3>
          <p className="max-w-[50ch] leading-relaxed text-muted">
            Sumá a tu equipo con un link. Cada profesional factura con su propio CUIT y quien administra ve la agenda de
            todos en una sola pantalla.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="font-serif text-2xl font-semibold">Los cobros siguen siendo tuyos</h3>
          <p className="max-w-[50ch] leading-relaxed text-muted">
            Orgatodo no cobra en tu nombre ni retiene dinero. Tus clientes te pagan a vos, como siempre.
          </p>
        </div>
      </section>

      <section className={`${fullBleed} bg-ink text-white`}>
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-16 sm:px-6">
          <div className="space-y-2">
            <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">¿Buscás turno?</h2>
            <p className="text-lg text-[#d3d9ec]">Buscá por servicio y zona, elegí un horario libre y listo.</p>
          </div>
          <div className="text-foreground">
            <SearchForm />
          </div>
          <nav aria-label="Rubros" className="flex flex-wrap gap-2">
            {POPULAR.map(([key, label]) => (
              <Link
                key={key}
                href={`/buscar?rubro=${key}`}
                className="rounded-full border border-[#4a5578] px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-6 py-16">
        <div className="space-y-2">
          <h2 className="font-serif text-3xl font-semibold tracking-tight">Probalo con tu propia agenda.</h2>
          <p className="text-muted">Cargás tus servicios y horarios, y tu página queda lista para compartir.</p>
        </div>
        <Link
          href="/registro"
          className="rounded-full bg-brand px-7 py-3.5 font-semibold text-white transition-colors hover:bg-brand-strong"
        >
          Crear mi cuenta
        </Link>
      </section>
    </div>
  );
}

/** Un día de agenda donde un turno ya quedó facturado: agenda y facturación en la misma hoja. */
function DiaDeAgenda() {
  return (
    <figure className="mx-auto w-full max-w-lg">
      <div className="rounded-[1.75rem] border border-border bg-surface p-5 shadow-[0_30px_60px_-30px_rgba(27,36,64,0.35)] sm:p-6">
        <div className="flex items-baseline justify-between gap-4 px-1 pb-4">
          <p className="font-serif text-xl font-semibold">Lunes 13 de octubre</p>
          <p className="text-sm text-muted">3 turnos</p>
        </div>

        <ul className="space-y-2">
          <li className="rounded-2xl bg-brand-soft p-4">
            <div className="flex items-center gap-4">
              <span className="w-12 font-semibold tabular-nums">09:00</span>
              <span className="flex-1">
                Carla Gómez<span className="hidden text-muted sm:inline">, sesión</span>
              </span>
              <span className="text-sm font-semibold whitespace-nowrap text-brand">Realizado</span>
            </div>
            <div className="factura-aparece mt-3 sm:ml-16 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-surface px-4 py-3 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-brand" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                Factura C 00002-00000148
              </span>
              <span className="font-semibold tabular-nums">$ 18.000,00</span>
              <span className="w-full text-xs text-muted">Autorizada por ARCA, CAE 76412398550127</span>
            </div>
          </li>
          <li className="flex items-center gap-4 rounded-2xl border border-border p-4">
            <span className="w-12 font-semibold tabular-nums">11:15</span>
            <span className="flex-1">
              Diego Castro<span className="hidden text-muted sm:inline">, evaluación</span>
            </span>
            <span className="text-sm whitespace-nowrap text-muted">Confirmado</span>
          </li>
          <li className="flex items-center gap-4 rounded-2xl border border-dashed border-border p-4 text-muted">
            <span className="w-12 font-semibold tabular-nums">14:00</span>
            <span className="flex-1">Libre</span>
          </li>
          <li className="flex items-center gap-4 rounded-2xl border border-border p-4">
            <span className="w-12 font-semibold tabular-nums">16:30</span>
            <span className="flex-1">
              Paula Ríos<span className="hidden text-muted sm:inline">, sesión</span>
            </span>
            <span className="text-sm whitespace-nowrap text-muted">Recordatorio enviado</span>
          </li>
        </ul>

        <div className="mt-5 space-y-2 border-t border-border px-1 pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted">Facturado en los últimos 12 meses</span>
            <span className="font-semibold tabular-nums">62% del tope</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-brand-soft">
            <div className="medidor-llena h-2 w-[62%] rounded-full bg-brand" />
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted">Agenda de ejemplo.</figcaption>
    </figure>
  );
}
