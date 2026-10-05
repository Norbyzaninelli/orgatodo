import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedProfessional } from "@/lib/agenda/queries";
import { formatDuration, formatPrice } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const data = await getPublishedProfessional(slug);
  return data ? { title: data.professional.displayName, description: data.professional.bio ?? undefined } : {};
}

export default async function ProfessionalPage(props: PageProps<"/[slug]">) {
  const { slug } = await props.params;
  const data = await getPublishedProfessional(slug);
  if (!data) notFound();
  const { professional, services } = data;

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{professional.displayName}</h1>
        {professional.bio && <p className="text-muted">{professional.bio}</p>}
        {professional.address && <p className="text-sm text-muted">{professional.address}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Servicios</h2>
        {services.length === 0 ? (
          <p className="text-muted">Todavía no hay servicios publicados.</p>
        ) : (
          <ul className="space-y-3">
            {services.map((service) => (
              <li key={service.id}>
                <Link
                  href={`/${professional.slug}/${service.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 transition hover:border-brand"
                >
                  <div>
                    <p className="font-semibold">{service.name}</p>
                    <p className="text-sm text-muted">
                      {formatDuration(service.durationMinutes)} ·{" "}
                      {service.modality === "virtual" ? "Virtual" : "Presencial"}
                    </p>
                    {service.description && <p className="mt-1 text-sm text-muted">{service.description}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatPrice(service.priceCents)}</p>
                    <p className="text-sm font-medium text-brand">Reservar</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
