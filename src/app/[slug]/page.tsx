import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Service } from "@/db/schema";
import { getPublishedProfessional } from "@/lib/agenda/queries";
import { getPublishedCentro, getPublishedCentroOf } from "@/lib/centros";
import { formatDuration, formatPrice } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const data = await getPublishedProfessional(slug);
  if (data) return { title: data.professional.displayName, description: data.professional.bio ?? undefined };
  const centro = await getPublishedCentro(slug);
  return centro ? { title: centro.organization.name, description: centro.organization.description ?? undefined } : {};
}

/** La dirección puede ser de un profesional o de un centro; nunca de los dos. */
export default async function PublicPage(props: PageProps<"/[slug]">) {
  const { slug } = await props.params;
  const data = await getPublishedProfessional(slug);
  if (data) return <ProfessionalPage {...data} />;
  const centro = await getPublishedCentro(slug);
  if (centro) return <CentroPage {...centro} />;
  notFound();
}

async function ProfessionalPage({ professional, services }: NonNullable<Awaited<ReturnType<typeof getPublishedProfessional>>>) {
  const centro = await getPublishedCentroOf(professional);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{professional.displayName}</h1>
        {professional.bio && <p className="text-muted">{professional.bio}</p>}
        {professional.address && <p className="text-sm text-muted">{professional.address}</p>}
        {centro && (
          <p className="text-sm">
            Atiende en{" "}
            <Link href={`/${centro.slug}`} className="font-medium text-brand hover:underline">
              {centro.name}
            </Link>
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Servicios</h2>
        {services.length === 0 ? (
          <p className="text-muted">Todavía no hay servicios publicados.</p>
        ) : (
          <ServiceList slug={professional.slug} services={services} />
        )}
      </section>
    </div>
  );
}

function CentroPage({ organization, team }: NonNullable<Awaited<ReturnType<typeof getPublishedCentro>>>) {
  const withServices = team.filter((member) => member.services.length > 0);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{organization.name}</h1>
        {organization.description && <p className="text-muted">{organization.description}</p>}
        {organization.address && <p className="text-sm text-muted">{organization.address}</p>}
        {organization.phone && (
          <a href={`https://wa.me/${organization.phone.replace(/\D/g, "")}`} className="text-sm font-medium text-brand hover:underline">
            {organization.phone}
          </a>
        )}
      </section>

      {withServices.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Profesionales">
          {withServices.map(({ professional }) => (
            <a
              key={professional.id}
              href={`#${professional.slug}`}
              className="rounded-full border border-border px-3 py-1 text-sm font-medium transition hover:border-brand"
            >
              {professional.displayName}
            </a>
          ))}
        </nav>
      )}

      {withServices.length === 0 ? (
        <p className="text-muted">Todavía no hay profesionales con turnos publicados.</p>
      ) : (
        withServices.map(({ professional, services }) => (
          <section key={professional.id} id={professional.slug} className="scroll-mt-6 space-y-3">
            <div>
              <h2 className="text-xl font-semibold">
                <Link href={`/${professional.slug}`} className="hover:underline">
                  {professional.displayName}
                </Link>
              </h2>
              {professional.bio && <p className="text-sm text-muted">{professional.bio}</p>}
            </div>
            <ServiceList slug={professional.slug} services={services} />
          </section>
        ))
      )}
    </div>
  );
}

function ServiceList({ slug, services }: { slug: string; services: Service[] }) {
  return (
    <ul className="space-y-3">
      {services.map((service) => (
        <li key={service.id}>
          <Link
            href={`/${slug}/${service.id}`}
            className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 transition hover:border-brand"
          >
            <div>
              <p className="font-semibold">{service.name}</p>
              <p className="text-sm text-muted">
                {formatDuration(service.durationMinutes)} · {service.modality === "virtual" ? "Virtual" : "Presencial"}
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
  );
}
