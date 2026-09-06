import { recordPublicBooking } from "./salon-ops";
import { useSalon } from "./store";
import type { Appointment, BookInput } from "./types";

export async function bookVisit(
  input: BookInput,
): Promise<{ ok: true; appointment: Appointment } | { ok: false; error: string }> {
  const store = useSalon.getState();
  if (!store.production) return store.book(input);
  const remote = await recordPublicBooking({ data: input });
  if (!remote.ok) return remote;
  store.applyBooked(remote.appointment, remote.client, {
    name: input.name,
    phone: input.phone,
    email: input.email,
  });
  return { ok: true, appointment: remote.appointment };
}
