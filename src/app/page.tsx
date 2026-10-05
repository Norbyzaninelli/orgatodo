import Link from "next/link";

export default function Home() {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 py-10">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Tus turnos y tu facturación, <span className="text-brand">en un solo lugar.</span>
      </h1>
      <p className="max-w-xl text-lg text-muted">
        ORGATODO es la plataforma para profesionales que trabajan en Argentina: publicás tus
        servicios, tus clientes reservan online, reciben recordatorios y vos facturás cada turno
        con ARCA sin salir de la app.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/registro"
          className="rounded-lg bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand-strong"
        >
          Crear mi cuenta
        </Link>
        <Link href="/ingresar" className="rounded-lg border border-border px-5 py-3 font-semibold transition hover:border-brand">
          Ingresar
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {[
          ["Agenda online", "Tus clientes eligen día y horario desde tu página."],
          ["Recordatorios", "Avisos automáticos para que nadie se olvide del turno."],
          ["Factura electrónica", "Emitís la factura C de cada turno con tu CUIT."],
        ].map(([title, text]) => (
          <li key={title} className="rounded-xl border border-border bg-surface p-4">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
