import Link from "next/link";
import type { ReactNode } from "react";
import { SearchForm } from "@/components/search-form";
import { AgendaAnimada, ChatWhatsApp, d } from "@/components/inicio/agenda-animada";
import { CelularReserva, HojaFactura, ResumenAnual } from "@/components/inicio/ilustraciones";
import { Revelar } from "@/components/inicio/revelar";
import { RUBROS } from "@/lib/rubros";

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

const RUBROS_CINTA = RUBROS.filter((r) => r.key !== "otros");

/** Las secciones de color ocupan todo el ancho aunque el layout centre el contenido. */
const fullBleed = "mx-[calc(50%-50vw)]";

export default function Home() {
  return (
    <div className="-mt-8 -mb-8">
      <section className="grid items-center gap-14 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 xl:pb-48">
        <div className="space-y-7">
          <h1
            className="anim-entra max-w-[14ch] font-serif text-[2.75rem] leading-[1.04] font-semibold tracking-tight sm:text-[4rem]"
            style={d(0)}
          >
            Tu agenda y tu monotributo, en orden.
          </h1>
          <p className="anim-entra max-w-[44ch] text-lg leading-relaxed text-muted" style={d(120)}>
            Tus clientes sacan turno solos y les llega el recordatorio por WhatsApp. Vos facturás cada turno en ARCA sin
            cargar nada dos veces, y siempre sabés cuánto te queda para el tope de tu categoría.
          </p>
          <div className="anim-entra flex flex-wrap gap-3" style={d(240)}>
            <Link
              href="/registro"
              className="rounded-full bg-brand px-7 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-brand-strong hover:shadow-lg"
            >
              Crear mi cuenta
            </Link>
            <Link
              href="#como-funciona"
              className="rounded-full border border-border bg-surface px-7 py-3.5 font-medium transition hover:-translate-y-0.5 hover:border-brand"
            >
              Ver cómo funciona
            </Link>
          </div>
        </div>

        <AgendaAnimada />
      </section>

      <section aria-label="Rubros" className={`${fullBleed} overflow-hidden border-y border-border bg-surface py-5`}>
        <div className="cinta flex w-max gap-10 pr-10">
          {[0, 1].map((copia) => (
            <ul key={copia} aria-hidden={copia === 1} className="flex shrink-0 items-center gap-10">
              {RUBROS_CINTA.map((r) => (
                <li key={r.key} className="flex items-center gap-10">
                  <Link
                    href={`/buscar?rubro=${r.key}`}
                    tabIndex={copia === 1 ? -1 : undefined}
                    className="font-serif text-xl whitespace-nowrap text-muted transition-colors hover:text-brand"
                  >
                    {r.label}
                  </Link>
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand/50" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-8 space-y-20 py-20 sm:space-y-28 sm:py-28">
        <Revelar className="max-w-2xl space-y-3">
          <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-[2.6rem]">Así se ve tu trabajo</h2>
          <p className="text-lg text-muted">
            Una página para que te reserven, avisos automáticos, facturas en un clic y tus números siempre a mano.
          </p>
        </Revelar>

        <Pantalla
          titulo="Tu página de turnos"
          texto="Compartís tu link por Instagram o WhatsApp y tus clientes eligen servicio, día y horario. Solo ven los horarios que tenés libres, así que nadie se superpone."
          imagen={<CelularReserva />}
        />
        <Pantalla
          titulo="Recordatorios que llegan solos"
          texto="Cada cliente recibe la confirmación al reservar y un recordatorio el día anterior. Menos mensajes para contestar y menos gente que se olvida."
          imagen={
            <div className="mx-auto w-full max-w-[15rem]">
              <ChatWhatsApp />
            </div>
          }
          invertida
        />
        <Pantalla
          titulo="La factura, lista en un clic"
          texto="Cuando marcás un turno como realizado, la factura C ya tiene el cliente, el concepto y el importe. La emitís con tu certificado y queda autorizada por ARCA con su CAE y su QR."
          imagen={<HojaFactura />}
        />
        <Pantalla
          titulo="Tus números, claros"
          texto="Ingresos, gastos y cuánto facturaste en los últimos 12 meses contra el tope de tu categoría. Te avisamos antes de que te acerques al límite."
          imagen={<ResumenAnual />}
          invertida
        />
      </section>

      <section className="space-y-12 border-t border-border py-20">
        <Revelar className="max-w-2xl space-y-3">
          <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-[2.6rem]">Qué pasa con cada turno</h2>
          <p className="text-lg text-muted">Un mismo turno pasa por tu agenda, tu facturación y tu resumen. Lo cargás una vez.</p>
        </Revelar>
        <Revelar as="ol" className="relative grid gap-8 lg:grid-cols-5 lg:gap-6">
          <span
            aria-hidden="true"
            className="al-ver-llena absolute top-5 bottom-5 left-5 w-px origin-top bg-brand/40 lg:right-[10%] lg:bottom-auto lg:left-[10%] lg:h-px lg:w-auto lg:origin-left"
          />
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
        </Revelar>
      </section>

      <section className="grid gap-10 border-t border-border py-16 md:grid-cols-2">
        <Revelar className="space-y-2">
          <h3 className="font-serif text-2xl font-semibold">¿Trabajás en un centro?</h3>
          <p className="max-w-[50ch] leading-relaxed text-muted">
            Sumá a tu equipo con un link. Cada profesional factura con su propio CUIT y quien administra ve la agenda de
            todos en una sola pantalla.
          </p>
        </Revelar>
        <Revelar className="space-y-2" delay={120}>
          <h3 className="font-serif text-2xl font-semibold">Los cobros siguen siendo tuyos</h3>
          <p className="max-w-[50ch] leading-relaxed text-muted">
            Orgatodo no cobra en tu nombre ni retiene dinero. Tus clientes te pagan a vos, como siempre.
          </p>
        </Revelar>
      </section>

      <section className={`${fullBleed} bg-ink text-white`}>
        <Revelar className="mx-auto max-w-6xl space-y-6 px-4 py-20 sm:px-6">
          <div className="space-y-2">
            <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">¿Buscás turno?</h2>
            <p className="text-lg text-[#d3d9ec]">Buscá por servicio y zona, elegí un horario libre y listo.</p>
          </div>
          <div className="text-foreground">
            <SearchForm />
          </div>
          <nav aria-label="Rubros populares" className="flex flex-wrap gap-2">
            {POPULAR.map(([key, label]) => (
              <Link
                key={key}
                href={`/buscar?rubro=${key}`}
                className="rounded-full border border-[#4a5578] px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:border-white"
              >
                {label}
              </Link>
            ))}
          </nav>
        </Revelar>
      </section>

      <Revelar as="section" className="flex flex-wrap items-center justify-between gap-6 py-20">
        <div className="space-y-2">
          <h2 className="font-serif text-3xl font-semibold tracking-tight">Probalo con tu propia agenda.</h2>
          <p className="text-muted">Cargás tus servicios y horarios, y tu página queda lista para compartir.</p>
        </div>
        <Link
          href="/registro"
          className="rounded-full bg-brand px-7 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-brand-strong hover:shadow-lg"
        >
          Crear mi cuenta
        </Link>
      </Revelar>
    </div>
  );
}

/** Una fila de "así se ve": la pantalla dibujada de un lado y la explicación del otro. */
function Pantalla({
  titulo,
  texto,
  imagen,
  invertida = false,
}: {
  titulo: string;
  texto: string;
  imagen: ReactNode;
  invertida?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <Revelar className={`space-y-3 ${invertida ? "md:order-2" : ""}`}>
        <h3 className="font-serif text-2xl font-semibold sm:text-3xl">{titulo}</h3>
        <p className="max-w-[46ch] text-lg leading-relaxed text-muted">{texto}</p>
      </Revelar>
      <Revelar delay={150} className={invertida ? "md:order-1" : ""}>
        <div className="levanta flex items-center justify-center rounded-[2rem] bg-brand-soft/70 px-6 py-12 sm:py-16">
          {imagen}
        </div>
      </Revelar>
    </div>
  );
}
