"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BookingError, bookingRequestSchema, cancelBookingByToken, createBooking } from "@/lib/agenda/booking";

export interface BookingFormState {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "phone", string>>;
}

export async function reserveAction(_prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const parsed = bookingRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fields = z.flattenError(parsed.error).fieldErrors;
    return {
      error: "Revisá los datos marcados.",
      fieldErrors: { name: fields.name?.[0], email: fields.email?.[0], phone: fields.phone?.[0] },
    };
  }

  let token: string;
  try {
    const booking = await createBooking(parsed.data);
    token = booking.manageToken;
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/${parsed.data.professionalSlug}/${parsed.data.serviceId}`);
  redirect(`/turno/${token}`);
}

export async function cancelAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  await cancelBookingByToken(token);
  revalidatePath(`/turno/${token}`);
}
