import { createFileRoute } from "@tanstack/react-router";
import { BookingFlow } from "@/components/booking-flow";
import { PublicShell } from "@/components/site-header";

type BookSearch = { service?: string; staff?: string };

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>): BookSearch => ({
    service: typeof search.service === "string" ? search.service : undefined,
    staff: typeof search.staff === "string" ? search.staff : undefined,
  }),
  component: BookPage,
});

function BookPage() {
  const { service, staff } = Route.useSearch();
  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <BookingFlow initialService={service} initialStaff={staff} />
      </div>
    </PublicShell>
  );
}
