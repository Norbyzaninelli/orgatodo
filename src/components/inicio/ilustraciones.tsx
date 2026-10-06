import type { CSSProperties } from "react";

/** Las tres pantallas de la app que muestra el inicio, dibujadas con datos de ejemplo. */

export function CelularReserva() {
  const slots = ["09:00", "09:45", "11:15", "14:00", "16:30", "17:15"];
  return (
    <div className="mx-auto w-full max-w-[15rem] rounded-[2.25rem] border-[7px] border-ink bg-ink shadow-[0_30px_60px_-30px_rgba(11,22,51,0.6)]">
      <div className="overflow-hidden rounded-[1.75rem] bg-background text-[0.7rem] text-foreground">
        <div className="flex justify-center py-2">
          <span className="h-1.5 w-14 rounded-full bg-ink/80" />
        </div>
        <div className="space-y-3 px-4 pb-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft font-display text-sm font-semibold text-brand">
              LF
            </span>
            <span className="leading-tight">
              <span className="block font-display text-sm font-semibold">Lucía Fernández</span>
              <span className="text-muted">Kinesióloga, Palermo</span>
            </span>
          </div>
          <div className="rounded-xl border-2 border-brand bg-surface p-2.5">
            <span className="flex justify-between font-semibold">
              <span>Sesión</span>
              <span className="tabular-nums">$ 18.000</span>
            </span>
            <span className="text-muted">45 minutos</span>
          </div>
          <div className="grid grid-cols-5 gap-1 text-center">
            {["lun", "mar", "mié", "jue", "vie"].map((dia, i) => (
              <span
                key={dia}
                className={`rounded-lg py-1.5 ${i === 0 ? "bg-brand text-white" : "border border-border bg-surface"}`}
              >
                {dia}
                <span className="block font-semibold tabular-nums">{13 + i}</span>
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1 text-center tabular-nums">
            {slots.map((s) => (
              <span
                key={s}
                className={`rounded-lg py-1.5 ${s === "11:15" ? "border-2 border-brand bg-brand-soft font-semibold" : "border border-border bg-surface"}`}
              >
                {s}
              </span>
            ))}
          </div>
          <span className="block rounded-full bg-brand py-2 text-center font-semibold text-white">Reservar</span>
        </div>
      </div>
    </div>
  );
}

export function HojaFactura() {
  return (
    <div className="mx-auto w-full max-w-xs rotate-[-1.5deg] rounded-lg bg-white p-5 text-[0.7rem] text-[#0b1633] shadow-[0_30px_60px_-30px_rgba(11,22,51,0.55)]">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 border-b border-[#e0dcd2] pb-3">
        <span className="leading-snug">
          <span className="block text-xs font-semibold">Lucía Fernández</span>
          <span className="text-[#4a5068]">Monotributo</span>
        </span>
        <span className="flex h-9 w-9 items-center justify-center border-2 border-[#0b1633] text-lg font-bold">C</span>
        <span className="text-right leading-snug">
          <span className="block text-xs font-semibold">Factura</span>
          <span className="text-[#4a5068] tabular-nums">00002-00000148</span>
        </span>
      </div>
      <div className="space-y-1 border-b border-[#e0dcd2] py-3">
        <p className="flex justify-between">
          <span className="text-[#4a5068]">Cliente</span>
          <span>Carla Gómez</span>
        </p>
        <p className="flex justify-between">
          <span className="text-[#4a5068]">Concepto</span>
          <span>Sesión de kinesiología</span>
        </p>
      </div>
      <p className="flex items-baseline justify-between py-3">
        <span className="text-[#4a5068]">Total</span>
        <span className="text-base font-semibold tabular-nums">$ 18.000,00</span>
      </p>
      <div className="flex items-end justify-between gap-3 border-t border-dashed border-[#c9c4b8] pt-3">
        <span className="space-y-0.5 leading-snug text-[#4a5068]">
          <span className="block tabular-nums">CAE 76412398550127</span>
          <span className="block">Vto. 23/10/2026</span>
          <span className="mt-1 inline-block rounded-full bg-[#e6ecff] px-2 py-0.5 font-semibold text-[#3b63ff]">
            Autorizada por ARCA
          </span>
        </span>
        <CodigoQr />
      </div>
    </div>
  );
}

/** Un patrón con forma de QR; es dibujo, no se puede escanear. */
function CodigoQr() {
  const celdas = "1110101011100101110110100010111110110111001001101100111011000101110010101001110100111".split("");
  return (
    <svg viewBox="0 0 9 9" className="h-14 w-14 shrink-0" aria-hidden="true">
      {celdas.slice(0, 81).map((c, i) =>
        c === "1" ? <rect key={i} x={i % 9} y={Math.floor(i / 9)} width="1" height="1" fill="#0b1633" /> : null,
      )}
      {[
        [0, 0],
        [6, 0],
        [0, 6],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="3" height="3" fill="#0b1633" />
          <rect x={x + 0.5} y={y + 0.5} width="2" height="2" fill="#fff" />
          <rect x={x + 1} y={y + 1} width="1" height="1" fill="#0b1633" />
        </g>
      ))}
    </svg>
  );
}

// Proporciones de ejemplo para el gráfico, no son datos reales.
const MESES = [
  ["nov", 52],
  ["dic", 61],
  ["ene", 44],
  ["feb", 48],
  ["mar", 70],
  ["abr", 66],
  ["may", 74],
  ["jun", 69],
  ["jul", 63],
  ["ago", 80],
  ["sep", 86],
  ["oct", 58],
] as const;

export function ResumenAnual() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-surface p-5 text-sm shadow-[0_30px_60px_-30px_rgba(11,22,51,0.45)]">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-base font-semibold">Ingresos por mes</p>
        <p className="text-xs text-muted">Ejemplo</p>
      </div>
      <div className="mt-4 flex h-32 items-end gap-1.5">
        {MESES.map(([mes, alto], i) => (
          <div key={mes} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div
              className={`al-ver-crece w-full rounded-t-md ${i === MESES.length - 1 ? "bg-brand/40" : "bg-brand"}`}
              style={{ height: `${alto}%`, "--b": `${i * 60}ms` } as CSSProperties}
            />
            <span className="text-[0.6rem] text-muted">{mes}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <p>
          <span className="block text-xs text-muted">Ingresos del mes</span>
          <span className="font-semibold tabular-nums">$ 1.120.000</span>
        </p>
        <p>
          <span className="block text-xs text-muted">Gastos del mes</span>
          <span className="font-semibold tabular-nums">$ 310.500</span>
        </p>
      </div>
      <div className="mt-4 space-y-1.5">
        <p className="flex justify-between text-xs">
          <span className="text-muted">Tope de tu categoría</span>
          <span className="font-semibold">62%</span>
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-brand-soft">
          <div className="al-ver-llena h-2 w-[62%] rounded-full bg-brand" />
        </div>
      </div>
    </div>
  );
}
