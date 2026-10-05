"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand-strong print:hidden"
    >
      Imprimir o guardar PDF
    </button>
  );
}
