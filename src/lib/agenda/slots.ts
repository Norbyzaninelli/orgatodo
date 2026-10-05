import { TZDate } from "@date-fns/tz";

/** Fecha local en formato YYYY-MM-DD. */
export type LocalDate = string;

export interface WeeklyRule {
  /** 0 = domingo ... 6 = sábado */
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface DateBlock {
  date: LocalDate;
  /** Sin horario = bloquea el día entero. */
  startMinute: number | null;
  endMinute: number | null;
}

export interface Interval {
  start: Date;
  end: Date;
}

export interface SlotInput {
  timezone: string;
  from: LocalDate;
  to: LocalDate;
  rules: WeeklyRule[];
  blocks: DateBlock[];
  holidays: LocalDate[];
  worksOnHolidays: boolean;
  /** Turnos ya tomados que no estén cancelados. */
  busy: Interval[];
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  stepMinutes: number;
  now: Date;
}

export interface DaySlots {
  date: LocalDate;
  slots: Interval[];
}

type MinuteRange = [number, number];

const MINUTE = 60_000;

export function parseLocalDate(value: LocalDate): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Fecha inválida: ${value}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function weekdayOf(value: LocalDate): number {
  const { year, month, day } = parseLocalDate(value);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDays(value: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(value);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Fecha local de un instante en la zona horaria dada. */
export function toLocalDate(instant: Date, timezone: string): LocalDate {
  const local = new TZDate(instant, timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

/** Instante correspondiente a una fecha local más minutos desde la medianoche. */
export function localToInstant(value: LocalDate, minute: number, timezone: string): Date {
  const { year, month, day } = parseLocalDate(value);
  const local = new TZDate(year, month - 1, day, Math.floor(minute / 60), minute % 60, timezone);
  return new Date(local.getTime());
}

function subtract(ranges: MinuteRange[], cut: MinuteRange): MinuteRange[] {
  const out: MinuteRange[] = [];
  for (const [s, e] of ranges) {
    if (cut[1] <= s || cut[0] >= e) {
      out.push([s, e]);
      continue;
    }
    if (cut[0] > s) out.push([s, cut[0]]);
    if (cut[1] < e) out.push([cut[1], e]);
  }
  return out;
}

/** Bloques de trabajo de un día, ya descontados feriados y bloqueos. */
export function workingRanges(input: SlotInput, date: LocalDate): MinuteRange[] {
  if (!input.worksOnHolidays && input.holidays.includes(date)) return [];

  const weekday = weekdayOf(date);
  let ranges: MinuteRange[] = input.rules
    .filter((r) => r.weekday === weekday && r.endMinute > r.startMinute)
    .map((r) => [r.startMinute, r.endMinute] as MinuteRange)
    .sort((a, b) => a[0] - b[0]);

  for (const block of input.blocks) {
    if (block.date !== date) continue;
    if (block.startMinute === null || block.endMinute === null) return [];
    ranges = subtract(ranges, [block.startMinute, block.endMinute]);
  }
  return ranges;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Calcula los horarios de inicio disponibles para un servicio entre dos fechas locales, inclusive.
 * El margen se aplica después de cada turno: un turno nuevo no puede empezar dentro del margen
 * del anterior ni terminar dentro del margen previo al siguiente.
 */
export function availableSlots(input: SlotInput): DaySlots[] {
  const earliest = new Date(input.now.getTime() + input.minNoticeMinutes * MINUTE);
  const busy = input.busy.map((b) => ({
    start: b.start,
    end: new Date(b.end.getTime() + input.bufferMinutes * MINUTE),
  }));

  const days: DaySlots[] = [];
  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    const slots: Interval[] = [];
    for (const [rangeStart, rangeEnd] of workingRanges(input, date)) {
      for (
        let minute = rangeStart;
        minute + input.durationMinutes <= rangeEnd;
        minute += input.stepMinutes
      ) {
        const start = localToInstant(date, minute, input.timezone);
        if (start < earliest) continue;
        const end = new Date(start.getTime() + input.durationMinutes * MINUTE);
        const withBuffer = { start, end: new Date(end.getTime() + input.bufferMinutes * MINUTE) };
        if (busy.some((b) => overlaps(withBuffer, b))) continue;
        slots.push({ start, end });
      }
    }
    days.push({ date, slots });
  }
  return days;
}

/** Verifica que un inicio puntual siga libre; se usa al confirmar la reserva. */
export function isSlotAvailable(input: Omit<SlotInput, "from" | "to">, start: Date): boolean {
  const date = toLocalDate(start, input.timezone);
  const [day] = availableSlots({ ...input, from: date, to: date });
  return day.slots.some((s) => s.start.getTime() === start.getTime());
}
