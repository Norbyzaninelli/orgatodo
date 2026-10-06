import type { CSSProperties } from "react";

/** Demora de una animación del inicio, en milisegundos. */
export const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * La agenda del inicio se arma sola: entran los turnos, el de las 9 pasa a realizado y se factura,
 * sale el recordatorio por WhatsApp al turno de la tarde y se llena el medidor del tope.
 */
export function AgendaAnimada() {
  return (
    <figure className="relative mx-auto w-full max-w-lg lg:mr-0">
      <div
        aria-hidden="true"
        className="absolute -inset-x-3 -inset-y-4 -z-10 sm:-inset-10 bg-[radial-gradient(var(--border)_1.5px,transparent_1.5px)] [background-size:22px_22px] [mask-image:radial-gradient(closest-side,black,transparent)]"
      />

      <div
        className="anim-entra rounded-[1.75rem] border border-border bg-surface p-5 shadow-[0_40px_80px_-40px_rgba(11,22,51,0.45)] sm:p-6"
        style={d(0)}
      >
        <div className="flex items-baseline justify-between gap-4 px-1 pb-4">
          <p className="font-display text-xl font-semibold">Lunes 13 de octubre</p>
          <p className="text-sm text-muted">3 turnos</p>
        </div>

        <ul className="space-y-2">
          <li className="anim-entra rounded-2xl bg-brand-soft p-4" style={d(300)}>
            <div className="flex items-center gap-4">
              <span className="w-12 font-semibold tabular-nums">09:00</span>
              <span className="flex-1">
                Carla Gómez<span className="hidden text-muted sm:inline">, sesión</span>
              </span>
              <span className="grid text-sm whitespace-nowrap">
                <span className="anim-sale col-start-1 row-start-1 text-muted" style={d(1500)}>
                  Confirmado
                </span>
                <span className="anim-entra col-start-1 row-start-1 text-right font-semibold text-brand" style={d(1700)}>
                  Realizado
                </span>
              </span>
            </div>
            <div className="anim-despliega" style={d(1950)}>
              <div className="min-h-0 overflow-hidden">
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl bg-surface px-4 py-3 text-sm sm:ml-16">
                  <span className="flex items-center gap-2 font-medium">
                    <Tilde />
                    Factura C 00002-00000148
                  </span>
                  <span className="font-semibold tabular-nums">$ 18.000,00</span>
                  <span className="w-full text-xs text-muted">Autorizada por ARCA, CAE 76412398550127</span>
                </div>
              </div>
            </div>
          </li>
          <li className="anim-entra flex items-center gap-4 rounded-2xl border border-border p-4" style={d(450)}>
            <span className="w-12 font-semibold tabular-nums">11:15</span>
            <span className="flex-1">
              Diego Castro<span className="hidden text-muted sm:inline">, evaluación</span>
            </span>
            <span className="text-sm whitespace-nowrap text-muted">Confirmado</span>
          </li>
          <li
            className="anim-entra flex items-center gap-4 rounded-2xl border border-dashed border-border p-4 text-muted"
            style={d(600)}
          >
            <span className="w-12 font-semibold tabular-nums">14:00</span>
            <span className="flex-1">Libre</span>
          </li>
          <li className="anim-entra flex items-center gap-4 rounded-2xl border border-border p-4" style={d(750)}>
            <span className="w-12 font-semibold tabular-nums">16:30</span>
            <span className="flex-1">
              Paula Ríos<span className="hidden text-muted sm:inline">, sesión</span>
            </span>
            <span className="anim-entra flex items-center gap-1.5 text-sm whitespace-nowrap text-muted" style={d(3300)}>
              <IconoWhatsApp className="h-4 w-4 text-[#1f9d55]" />
              Recordatorio enviado
            </span>
          </li>
        </ul>

        <div className="mt-5 space-y-2 border-t border-border px-1 pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted">Facturado en los últimos 12 meses</span>
            <span className="font-semibold tabular-nums">62% del tope</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-brand-soft">
            <div className="anim-llena h-2 w-[62%] rounded-full bg-brand" style={d(3600)} />
          </div>
        </div>
      </div>

      <div className="absolute -bottom-40 -left-[11.5rem] hidden w-56 xl:block">
        <div className="anim-entra" style={d(2400)}>
          <div className="anim-flota">
            <ChatWhatsApp delay={2900} />
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted">Agenda de ejemplo.</figcaption>
    </figure>
  );
}

/** El recordatorio que le llega al cliente, en un celular chico. */
export function ChatWhatsApp({ delay = 0 }: { delay?: number }) {
  return (
    <div className="rounded-[2rem] border-[6px] border-ink bg-ink shadow-[0_30px_60px_-25px_rgba(11,22,51,0.6)]">
      <div className="overflow-hidden rounded-[1.5rem] bg-[#ece5dd]">
        <div className="flex items-center gap-2 bg-[#1f5f4a] px-3 py-2.5 text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
            <CalendarioMini />
          </span>
          <span className="text-xs leading-tight">
            <span className="block font-semibold">Lucía Fernández</span>
            <span className="opacity-80">vía Orgatodo</span>
          </span>
        </div>
        <div className="space-y-2 px-2.5 py-3 text-[0.7rem] leading-snug text-[#0b1633]">
          <p className="anim-burbuja max-w-[92%] rounded-lg rounded-tl-none bg-white px-2.5 py-2 shadow-sm" style={d(delay)}>
            Hola Paula, te recordamos tu turno de mañana a las 16:30 con Lucía Fernández.
            <span className="mt-1 block text-right text-[0.6rem] text-[#6b7280]">10:02</span>
          </p>
          <p
            className="anim-burbuja ml-auto max-w-[60%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-2.5 py-2 shadow-sm"
            style={d(delay + 900)}
          >
            ¡Perfecto, ahí estaré!
            <span className="mt-1 block text-right text-[0.6rem] text-[#6b7280]">10:05</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function Tilde() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-brand" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function CalendarioMini() {
  return (
    <svg width="14" height="14" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <rect x="3" y="6" width="28" height="25" rx="5" />
      <path d="M3 13h28M11 3v6M23 3v6" />
    </svg>
  );
}

export function IconoWhatsApp({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.7L4 20z" strokeLinejoin="round" />
      <path d="M9.5 9.5c.3 1.6 1.4 3.2 3 4.2.6.4 1.3.6 1.8.3l.7-.7" strokeLinecap="round" />
    </svg>
  );
}
