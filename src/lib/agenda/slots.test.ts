import { describe, expect, it } from "vitest";
import {
  addDays,
  availableSlots,
  isSlotAvailable,
  localToInstant,
  toLocalDate,
  weekdayOf,
  type SlotInput,
} from "./slots";

const TZ = "America/Argentina/Buenos_Aires";

// Lunes 5 de octubre de 2026, 8:00 en Buenos Aires (UTC-3).
const MONDAY = "2026-10-05";
const NOW = new Date("2026-10-05T11:00:00Z");

function base(overrides: Partial<SlotInput> = {}): SlotInput {
  return {
    timezone: TZ,
    from: MONDAY,
    to: MONDAY,
    rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 }],
    blocks: [],
    holidays: [],
    worksOnHolidays: false,
    busy: [],
    durationMinutes: 60,
    bufferMinutes: 0,
    minNoticeMinutes: 0,
    stepMinutes: 60,
    now: NOW,
    ...overrides,
  };
}

const startsOf = (input: SlotInput) =>
  availableSlots(input).flatMap((d) => d.slots.map((s) => s.start.toISOString()));

describe("fechas locales", () => {
  it("calcula el día de la semana", () => {
    expect(weekdayOf(MONDAY)).toBe(1);
    expect(weekdayOf("2026-10-04")).toBe(0);
  });

  it("suma días cruzando meses", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("convierte hora local de Buenos Aires a UTC", () => {
    expect(localToInstant(MONDAY, 9 * 60, TZ).toISOString()).toBe("2026-10-05T12:00:00.000Z");
  });

  it("obtiene la fecha local de un instante cerca de medianoche", () => {
    expect(toLocalDate(new Date("2026-10-06T02:30:00Z"), TZ)).toBe(MONDAY);
  });
});

describe("availableSlots", () => {
  it("ofrece los horarios del bloque semanal", () => {
    expect(startsOf(base())).toEqual([
      "2026-10-05T12:00:00.000Z",
      "2026-10-05T13:00:00.000Z",
      "2026-10-05T14:00:00.000Z",
    ]);
  });

  it("no ofrece un turno que no entra antes del cierre", () => {
    expect(startsOf(base({ durationMinutes: 90, stepMinutes: 30 }))).toEqual([
      "2026-10-05T12:00:00.000Z",
      "2026-10-05T12:30:00.000Z",
      "2026-10-05T13:00:00.000Z",
      "2026-10-05T13:30:00.000Z",
    ]);
  });

  it("respeta varios bloques en el día", () => {
    const rules = [
      { weekday: 1, startMinute: 16 * 60, endMinute: 17 * 60 },
      { weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 },
    ];
    expect(startsOf(base({ rules }))).toEqual([
      "2026-10-05T12:00:00.000Z",
      "2026-10-05T19:00:00.000Z",
    ]);
  });

  it("no ofrece nada en días sin horario", () => {
    expect(startsOf(base({ from: "2026-10-06", to: "2026-10-06" }))).toEqual([]);
  });

  it("saltea feriados salvo que el profesional trabaje esos días", () => {
    expect(startsOf(base({ holidays: [MONDAY] }))).toEqual([]);
    expect(startsOf(base({ holidays: [MONDAY], worksOnHolidays: true }))).toHaveLength(3);
  });

  it("aplica bloqueos de día entero y parciales", () => {
    expect(startsOf(base({ blocks: [{ date: MONDAY, startMinute: null, endMinute: null }] }))).toEqual([]);
    expect(
      startsOf(base({ blocks: [{ date: MONDAY, startMinute: 10 * 60, endMinute: 11 * 60 }] })),
    ).toEqual(["2026-10-05T12:00:00.000Z", "2026-10-05T14:00:00.000Z"]);
  });

  it("excluye horarios ocupados", () => {
    const busy = [{ start: new Date("2026-10-05T13:00:00Z"), end: new Date("2026-10-05T14:00:00Z") }];
    expect(startsOf(base({ busy }))).toEqual(["2026-10-05T12:00:00.000Z", "2026-10-05T14:00:00.000Z"]);
  });

  it("deja el margen después de cada turno, propio y ajeno", () => {
    // Turno tomado de 10:00 a 11:00 y 15 minutos de margen.
    const busy = [{ start: new Date("2026-10-05T13:00:00Z"), end: new Date("2026-10-05T14:00:00Z") }];
    // 9:00 terminaría a las 10:00 y su margen pisa el turno de las 10: queda afuera.
    // Después del turno, el primer inicio posible es 11:15. El margen final puede pasar el cierre.
    const rules = [{ weekday: 1, startMinute: 9 * 60, endMinute: 13 * 60 }];
    expect(startsOf(base({ rules, busy, bufferMinutes: 15, stepMinutes: 15 }))).toEqual([
      "2026-10-05T14:15:00.000Z",
      "2026-10-05T14:30:00.000Z",
      "2026-10-05T14:45:00.000Z",
      "2026-10-05T15:00:00.000Z",
    ]);
  });

  it("respeta la anticipación mínima", () => {
    // Ahora son las 8:00; con 2 horas de anticipación el primer turno es a las 10:00.
    expect(startsOf(base({ minNoticeMinutes: 120 }))).toEqual([
      "2026-10-05T13:00:00.000Z",
      "2026-10-05T14:00:00.000Z",
    ]);
  });

  it("devuelve un elemento por día del rango", () => {
    const days = availableSlots(base({ to: addDays(MONDAY, 6) }));
    expect(days.map((d) => d.date)).toHaveLength(7);
    expect(days.filter((d) => d.slots.length > 0).map((d) => d.date)).toEqual([MONDAY]);
  });
});

describe("isSlotAvailable", () => {
  it("confirma un horario libre y rechaza uno tomado o fuera de grilla", () => {
    const { from: _f, to: _t, ...rest } = base();
    void _f;
    void _t;
    expect(isSlotAvailable(rest, new Date("2026-10-05T12:00:00Z"))).toBe(true);
    expect(isSlotAvailable(rest, new Date("2026-10-05T12:30:00Z"))).toBe(false);
    const busy = [{ start: new Date("2026-10-05T12:00:00Z"), end: new Date("2026-10-05T13:00:00Z") }];
    expect(isSlotAvailable({ ...rest, busy }, new Date("2026-10-05T12:00:00Z"))).toBe(false);
  });
});
