import type { Metadata } from "next";
import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { RatingBadge } from "@/components/stars";
import { searchListings, type Listing } from "@/lib/buscador";
import { formatPrice, plural } from "@/lib/format";
import { rubroLabel } from "@/lib/rubros";

export async function generateMetadata(props: PageProps<"/buscar">): Promise<Metadata> {
  const { rubro, zona } = await props.searchParams;
  const what = (typeof rubro === "string" && rubroLabel(rubro)) || "Profesionales";
  const where = typeof zona === "string" && zona.trim() ? ` en ${zona.trim()}` : "";
  return { title: `${what}${where}`, description: `Reservá turnos online con ${what.toLowerCase()}${where} en ORGATODO.` };
}

function param(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function SearchPage(props: PageProps<"/buscar">) {
  const search = await props.searchParams;
  const filters = { q: param(search.q), rubro: param(search.rubro), zona: param(search.zona) };
  const results = await searchListings(filters);
  const searching = Boolean(filters.q?.trim() || filters.rubro || filters.zona?.trim());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Encontrá con quién sacar turno</h1>
      <SearchForm {...filters} />
      <p className="text-sm text-muted">
        {results.length === 0
          ? searching
            ? "No encontramos resultados. Probá con otra zona o sin elegir rubro."
            : "Todavía no hay profesionales publicados."
          : plural(results.length, "resultado")}
      </p>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {results.map((listing) => (
          <ListingCard key={`${listing.kind}:${listing.slug}`} listing={listing} />
        ))}
      </ul>
    </div>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <li>
      <Link
        href={listing.href}
        className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition hover:border-brand"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {listing.kind === "centro" && (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">Centro</span>
            )}
            {listing.rubro && <span className="text-xs font-medium uppercase tracking-wide text-muted">{listing.rubro}</span>}
          </div>
          <p className="text-lg font-semibold">{listing.name}</p>
          <RatingBadge rating={listing.rating} />
          {listing.zona && <p className="text-sm text-muted">{listing.zona}</p>}
          {listing.team.length > 0 && <p className="text-sm text-muted">Con {listing.team.join(", ")}</p>}
          {listing.description && <p className="line-clamp-2 text-sm text-muted">{listing.description}</p>}
        </div>
        <ul className="space-y-1 text-sm">
          {listing.services.map((service, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="truncate">{service.name}</span>
              <span className="shrink-0 font-medium">{formatPrice(service.priceCents)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-auto flex items-center justify-between text-sm">
          {listing.fromPriceCents !== null && <span className="text-muted">Desde {formatPrice(listing.fromPriceCents)}</span>}
          <span className="font-semibold text-brand">Ver turnos</span>
        </p>
      </Link>
    </li>
  );
}
