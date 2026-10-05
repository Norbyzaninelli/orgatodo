import { after } from "next/server";
import { processDueNotifications } from "./process";
import { enqueueBookingEvent, type BookingEvent, type EventOptions } from "./queue";

/**
 * Programa los avisos de un turno y los manda después de responder, sin demorar a quien reserva.
 * Un problema con los avisos nunca hace fallar la reserva: queda en el log y en la cola.
 */
export async function notifyBookingEvent(bookingId: string, event: BookingEvent, options?: EventOptions) {
  try {
    await enqueueBookingEvent(bookingId, event, options);
  } catch (error) {
    console.error(`[avisos] no se pudieron programar los avisos de ${bookingId}`, error);
    return;
  }
  after(async () => {
    try {
      await processDueNotifications();
    } catch (error) {
      console.error("[avisos] error al mandar avisos", error);
    }
  });
}
