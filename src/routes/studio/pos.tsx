import { createFileRoute } from "@tanstack/react-router";
import { PosPanel } from "@/components/pos-panel";

type PosSearch = { appointment?: string };

export const Route = createFileRoute("/studio/pos")({
  validateSearch: (search: Record<string, unknown>): PosSearch => ({
    appointment: typeof search.appointment === "string" ? search.appointment : undefined,
  }),
  component: PosPage,
});

function PosPage() {
  const { appointment } = Route.useSearch();
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Register</p>
      <h1 className="mb-6 font-serif text-3xl font-medium">Checkout</h1>
      <PosPanel appointmentId={appointment} />
    </div>
  );
}
