import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { ActionForm } from "@/components/action-form";
import { ServiceFields } from "@/components/service-fields";
import { db, schema } from "@/db";
import { requireProfessional } from "@/lib/auth";
import { formatDuration, formatPrice } from "@/lib/format";
import { saveServiceAction, toggleServiceAction } from "../actions";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServicesPage() {
  const pro = await requireProfessional();
  const services = await db
    .select()
    .from(schema.services)
    .where(eq(schema.services.professionalId, pro.id))
    .orderBy(desc(schema.services.active), asc(schema.services.position), asc(schema.services.name));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Tus servicios</h2>
        {services.length === 0 && <p className="text-muted">Todavía no cargaste ningún servicio.</p>}
        <ul className="space-y-3">
          {services.map((service) => (
            <li key={service.id} className="rounded-xl border border-border bg-surface">
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                  <div className={service.active ? "" : "opacity-50"}>
                    <p className="font-semibold">{service.name}</p>
                    <p className="text-sm text-muted">
                      {formatDuration(service.durationMinutes)} · {formatPrice(service.priceCents)} ·{" "}
                      {service.modality === "virtual" ? "Virtual" : "Presencial"}
                      {!service.active && " · Oculto"}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-brand">Editar</span>
                </summary>
                <div className="space-y-4 border-t border-border p-4">
                  <ActionForm action={saveServiceAction} submitLabel="Guardar cambios">
                    <ServiceFields service={service} />
                  </ActionForm>
                  <form action={toggleServiceAction}>
                    <input type="hidden" name="serviceId" value={service.id} />
                    <input type="hidden" name="active" value={String(!service.active)} />
                    <button type="submit" className="text-sm font-medium text-muted hover:text-foreground">
                      {service.active ? "Ocultar de mi página" : "Volver a mostrar en mi página"}
                    </button>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold">Agregar un servicio</h2>
        <ActionForm action={saveServiceAction} submitLabel="Agregar servicio" resetOnSuccess>
          <ServiceFields />
        </ActionForm>
      </section>
    </div>
  );
}
