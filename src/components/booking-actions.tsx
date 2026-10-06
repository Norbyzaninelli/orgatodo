import { setBookingStatusAction } from "@/app/panel/actions";
import type { Booking } from "@/db/schema";

/** Botones para cambiar el estado de un turno según si ya pasó o no. */
export function BookingActions({ booking, now }: { booking: Booking; now: Date }) {
  const active = booking.status === "reservado" || booking.status === "confirmado";
  if (!active) return null;
  const past = booking.startsAt < now;
  return (
    <>
      {past && (
        <>
          <StatusButton id={booking.id} status="realizado" label="Realizado" />
          <StatusButton id={booking.id} status="ausente" label="No vino" />
        </>
      )}
      {!past && booking.status === "reservado" && <StatusButton id={booking.id} status="confirmado" label="Confirmar" />}
      {!past && <StatusButton id={booking.id} status="cancelado" label="Cancelar" />}
    </>
  );
}

function StatusButton({ id, status, label }: { id: string; status: string; label: string }) {
  return (
    <form action={setBookingStatusAction}>
      <input type="hidden" name="bookingId" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="rounded-lg border border-border px-2.5 py-1 text-sm font-medium transition hover:border-brand"
      >
        {label}
      </button>
    </form>
  );
}
