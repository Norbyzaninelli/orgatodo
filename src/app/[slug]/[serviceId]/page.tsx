import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BookingForm } from "@/components/booking-form";
import { bookableRange, getPublishedProfessional, getSlots } from "@/lib/agenda/queries";
import { formatDayChip, formatDuration, formatLongDate, formatPrice, formatTime } from "@/lib/format";

async function load(props: PageProps<"/[slug]/[serviceId]">) {
  const { slug, serviceId } = await props.params;
  if (!z.uuid().safeParse(serviceId).success) return null;
  const data = await getPublishedProfessional(slug);
  const service = data?.services.find((s) => s.id === serviceId);
  return data && service ? { ...data, service } : null;
}

export async function generateMetadata(props: PageProps<"/[slug]/[serviceId]">): Promise<Metadata> {
  const data = await load(props);
  return data ? { title: `${data.service.name} con ${data.professional.displayName}` } : {};
}

export default async function ServiceBookingPage(props: PageProps<"/[slug]/[serviceId]">) {
  const data = await load(props);
  if (!data) notFound();
  const { professional, service } = data;
  const search = await props.searchParams;
  const requestedDate = typeof search.fecha === "string" ? search.fecha : undefined;
  const requestedTime = typeof search.hora === "string" ? search.hora : undefined;

  const range = bookableRange(professional);
  const days = await getSlots(professional, service, range.from, range.to);
  const selected =
    days.find((d) => d.date === requestedDate) ?? days.find((d) => d.slots.length > 0) ?? days[0];
  const selectedSlot = requestedTime
    ? selected.slots.find((s) => s.start.toISOString() === requestedTime)
    : undefined;
  const basePath = `/${professional.slug}/${service.id}`;
  const tz = professional.timezone;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="space-y-1">
        <Link href={`/${professional.slug}`} className="text-sm text-brand hover:underline">
          ← {professional.displayName}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{service.name}</h1>
        <p className="text-muted">
          {formatDuration(service.durationMinutes)} · {formatPrice(service.priceCents)}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Elegí el día</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {days.map((day) => {
            const chip = formatDayChip(day.date);
            const active = day.date === selected.date;
            const empty = day.slots.length === 0;
            return (
              <Link
                key={day.date}
                href={`${basePath}?fecha=${day.date}`}
                aria-disabled={empty}
                className={[
                  "flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 text-sm transition",
                  active
                    ? "border-brand bg-brand text-white"
                    : empty
                      ? "pointer-events-none border-border bg-surface text-muted opacity-50"
                      : "border-border bg-surface hover:border-brand",
                ].join(" ")}
              >
                <span className="capitalize">{chip.weekday}</span>
                <span className="text-lg font-semibold">{chip.day}</span>
                <span className="capitalize">{chip.month}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Elegí el horario</h2>
        {selected.slots.length === 0 ? (
          <p className="text-muted">No hay horarios libres este día.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {selected.slots.map((slot) => {
              const iso = slot.start.toISOString();
              const active = selectedSlot?.start.toISOString() === iso;
              return (
                <Link
                  key={iso}
                  href={`${basePath}?fecha=${selected.date}&hora=${encodeURIComponent(iso)}`}
                  scroll={false}
                  className={[
                    "rounded-lg border py-2 text-center font-medium transition",
                    active ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand",
                  ].join(" ")}
                >
                  {formatTime(slot.start, tz)}
                </Link>
              );
            })}
          </div>
        )}
        {requestedTime && !selectedSlot && (
          <p className="text-sm text-danger">Ese horario ya no está disponible. Elegí otro.</p>
        )}
      </section>

      {selectedSlot && (
        <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <p>
            <span className="font-semibold">{service.name}</span> el{" "}
            <span className="font-semibold">{formatLongDate(selectedSlot.start, tz)}</span> a las{" "}
            <span className="font-semibold">{formatTime(selectedSlot.start, tz)}</span>
          </p>
          <BookingForm
            professionalSlug={professional.slug}
            serviceId={service.id}
            startsAt={selectedSlot.start.toISOString()}
          />
        </section>
      )}
    </div>
  );
}
