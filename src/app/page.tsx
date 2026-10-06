import Image from "next/image";
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

// Fotos de Unsplash (licencia Unsplash), guardadas en public/fotos. Ver public/fotos/CREDITOS.md.
const FOTOS_RUBROS = [
  ["peluqueria", "Peluquería", "/fotos/peluqueria.jpg", "Peluquera secando el pelo de una clienta"],
  ["kinesiologia", "Kinesiología", "/fotos/kinesiologia.jpg", "Kinesiólogo revisando la rodilla de un paciente"],
  ["psicologia", "Psicología", "/fotos/psicologia.jpg", "Psicóloga conversando con una paciente en su consultorio"],
  ["barberia", "Barbería", "/fotos/barberia.jpg", "Barbero cortando el pelo con máquina"],
  ["nutricion", "Nutrición", "/fotos/nutricion.jpg", "Nutricionista en su escritorio con frutas y verduras"],
  ["unas", "Uñas", "/fotos/unas.jpg", "Manicura trabajando en las uñas de una clienta"],
] as const;

const RUBROS_CINTA = RUBROS.filter((r) => r.key !== "otros");

/** Las secciones de color ocupan todo el ancho aunque el layout centre el contenido. */
const fullBleed = "mx-[calc(50%-50vw)]";

export default function Home() {
  return (
    <div className="-mt-8 -mb-8">
      <section
        className={`${fullBleed} relative isolate flex min-h-[38rem] items-end overflow-hidden bg-ink text-white sm:min-h-[42rem]`}
      >
        <Image
          src="/fotos/profesional.jpg"
          alt="Profesional confirmando un turno por teléfono frente a su computadora"
          fill
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
          className="anim-acerca -z-20 object-cover object-[30%_30%]"
        />
        {/* Oscurece la izquierda para que el texto se lea; la derecha deja ver la foto. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(11,22,51,0.94)_0%,rgba(11,22,51,0.74)_45%,rgba(11,22,51,0.12)_80%),linear-gradient(0deg,rgba(11,22,51,0.7),transparent_45%)]"
        />
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-24 pb-12 sm:px-6 sm:pb-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-2xl space-y-7">
            <h1
              className="anim-entra font-display text-[3rem] leading-[0.95] font-extrabold text-balance [font-stretch:78%] sm:text-[4.75rem]"
              style={d(0)}
            >
              Vos atendé. La agenda y las facturas se ordenan solas.
            </h1>
            <p className="anim-entra max-w-[44ch] text-lg leading-relaxed text-[#c9d2ec]" style={d(150)}>
              Tus clientes sacan turno solos y les llega el recordatorio por WhatsApp. Vos facturás cada turno en ARCA
              sin cargar nada dos veces, y siempre sabés cuánto te queda para el tope de tu categoría.
            </p>
            <div className="anim-entra flex flex-wrap gap-3" style={d(300)}>
              <Link
                href="/registro"
                className="rounded-full bg-brand px-7 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-brand-strong hover:shadow-lg"
              >
                Crear mi cuenta
              </Link>
              <Link
                href="#como-funciona"
                className="rounded-full border border-white/40 px-7 py-3.5 font-medium text-white transition hover:-translate-y-0.5 hover:border-white"
              >
                Ver cómo funciona
              </Link>
            </div>
          </div>
          <div
            className="anim-entra w-full max-w-[17rem] space-y-1 rounded-2xl bg-white/95 p-5 text-[#0b1633] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]"
            style={d(1100)}
          >
            <p className="text-sm text-[#5a6585]">Hoy, 18:40</p>
            <p className="font-semibold">Turno de Paula facturado</p>
            <p className="font-display text-3xl font-extrabold tabular-nums">$ 18.000,00</p>
            <p className="text-sm text-[#5a6585]">Factura C autorizada por ARCA</p>
          </div>
        </div>
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
                    className="font-display text-xl whitespace-nowrap text-muted transition-colors hover:text-brand"
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

      <section className="space-y-10 pt-20 sm:pt-28">
        <Revelar className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-[2.6rem]">
              Para quienes trabajan con turnos
            </h2>
            <p className="text-lg text-muted">
              Consultorios, salones y gabinetes que quieren la agenda, los cobros y el monotributo en un solo lugar.
            </p>
          </div>
          <Link href="/buscar" className="font-medium text-brand underline-offset-4 hover:underline">
            Ver todos los rubros
          </Link>
        </Revelar>
        <Revelar as="ul" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {FOTOS_RUBROS.map(([key, label, src, alt]) => (
            <li key={key}>
              <Link
                href={`/buscar?rubro=${key}`}
                className="group relative block aspect-[3/4] overflow-hidden rounded-3xl bg-brand-soft sm:aspect-[4/3]"
              >
                <Image
                  src={src}
                  alt={alt}
                  fill
                  sizes="(min-width: 1152px) 370px, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition duration-700 ease-out group-hover:scale-105"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#0b1633]/85 via-[#0b1633]/10 to-transparent"
                />
                <span className="absolute inset-x-4 bottom-4 font-display text-xl font-bold text-white sm:text-2xl">{label}</span>
              </Link>
            </li>
          ))}
        </Revelar>
      </section>

      <section id="como-funciona" className="scroll-mt-8 space-y-20 py-20 sm:space-y-28 sm:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 xl:pb-40">
          <Revelar className="max-w-xl space-y-3">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-[2.6rem]">Así se ve tu trabajo</h2>
            <p className="text-lg text-muted">
              Una página para que te reserven, avisos automáticos, facturas en un clic y tus números siempre a mano.
              Mirá cómo se arma un día: el turno se realiza, se factura y sale el recordatorio de la tarde.
            </p>
          </Revelar>
          <Revelar>
            <AgendaAnimada />
          </Revelar>
        </div>

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
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-[2.6rem]">Qué pasa con cada turno</h2>
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
                <p className="font-display text-xl font-bold">{titulo}</p>
                <p className="max-w-[32ch] leading-relaxed text-muted">{texto}</p>
              </div>
            </li>
          ))}
        </Revelar>
      </section>

      <section className="grid items-center gap-10 border-t border-border py-16 md:grid-cols-2 md:gap-16">
        <Revelar className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-brand-soft">
          <Image
            src="/fotos/centro.jpg"
            alt="Centro con varios puestos de trabajo y la administradora en la recepción"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
          {/* La foto es en blanco y negro: un velo azul la lleva a los colores de la marca. */}
          <span aria-hidden="true" className="absolute inset-0 bg-brand/25 mix-blend-multiply" />
        </Revelar>
        <div className="space-y-10">
          <Revelar className="space-y-2">
            <h3 className="font-display text-2xl font-bold">¿Trabajás en un centro?</h3>
            <p className="max-w-[50ch] leading-relaxed text-muted">
              Sumá a tu equipo con un link. Cada profesional factura con su propio CUIT y quien administra ve la agenda
              de todos en una sola pantalla.
            </p>
          </Revelar>
          <Revelar className="space-y-2" delay={120}>
            <h3 className="font-display text-2xl font-bold">Los cobros siguen siendo tuyos</h3>
            <p className="max-w-[50ch] leading-relaxed text-muted">
              Orgatodo no cobra en tu nombre ni retiene dinero. Tus clientes te pagan a vos, como siempre.
            </p>
          </Revelar>
        </div>
      </section>

      <section className={`${fullBleed} relative isolate overflow-hidden bg-ink text-white`}>
        <Image
          src="/fotos/buenos-aires.jpg"
          alt=""
          fill
          sizes="100vw"
          className="-z-10 object-cover object-[center_60%]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,#0b1633_30%,rgba(11,22,51,0.82)_60%,rgba(11,22,51,0.55))]"
        />
        <Revelar className="mx-auto max-w-6xl space-y-6 px-4 py-24 sm:px-6 sm:py-28">
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">¿Buscás turno?</h2>
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
          <h2 className="font-display text-3xl font-bold tracking-tight">Probalo con tu propia agenda.</h2>
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
        <h3 className="font-display text-2xl font-bold sm:text-3xl">{titulo}</h3>
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
