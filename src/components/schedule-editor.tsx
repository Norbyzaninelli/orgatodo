"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import type { FormState } from "@/lib/form-state";
import { WEEKDAYS, WEEK_ORDER } from "@/lib/time";

interface Block {
  key: number;
  weekday: number;
  start: string;
  end: string;
}

interface Props {
  initial: { weekday: number; start: string; end: string }[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}

const timeClass =
  "rounded-lg border border-border bg-background px-2 py-1.5 outline-none focus:border-brand";

let nextKey = 0;

/** Editor del horario semanal: varios bloques por día. */
export function ScheduleEditor({ initial, action }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => initial.map((b) => ({ ...b, key: nextKey++ })));
  const [state, formAction, pending] = useActionState(action, {});

  const update = (key: number, patch: Partial<Block>) =>
    setBlocks((all) => all.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const remove = (key: number) => setBlocks((all) => all.filter((b) => b.key !== key));
  const add = (weekday: number) => {
    const last = blocks.filter((b) => b.weekday === weekday).at(-1);
    const block = last ? { start: last.end, end: last.end < "20:00" ? "20:00" : "23:00" } : { start: "09:00", end: "18:00" };
    setBlocks((all) => [...all, { key: nextKey++, weekday, ...block }]);
  };

  const payload = JSON.stringify(blocks.map(({ weekday, start, end }) => ({ weekday, start, end })));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="blocks" value={payload} />
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {WEEK_ORDER.map((weekday) => {
          const dayBlocks = blocks.filter((b) => b.weekday === weekday);
          return (
            <li key={weekday} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
              <p className="w-28 shrink-0 pt-1.5 font-medium">{WEEKDAYS[weekday]}</p>
              <div className="flex-1 space-y-2">
                {dayBlocks.length === 0 && <p className="pt-1.5 text-sm text-muted">No atendés</p>}
                {dayBlocks.map((block) => (
                  <div key={block.key} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={block.start}
                      onChange={(e) => update(block.key, { start: e.target.value })}
                      aria-label={`${WEEKDAYS[weekday]} desde`}
                      className={timeClass}
                      required
                    />
                    <span className="text-muted">a</span>
                    <input
                      type="time"
                      value={block.end}
                      onChange={(e) => update(block.key, { end: e.target.value })}
                      aria-label={`${WEEKDAYS[weekday]} hasta`}
                      className={timeClass}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => remove(block.key)}
                      className="px-2 text-muted hover:text-danger"
                      aria-label="Quitar bloque"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => add(weekday)} className="text-sm font-medium text-brand hover:underline">
                  + Agregar horario
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand">{state.ok}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar horarios"}
      </button>
    </form>
  );
}
