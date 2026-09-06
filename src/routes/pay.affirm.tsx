import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AffirmMark } from "@/components/affirm-mark";
import { Button } from "@/components/ui/button";
import { AFFIRM_PLANS, affirmMonthly } from "@/lib/affirm";
import { money } from "@/lib/format";
import { loadPending, type PendingPay } from "@/lib/pending-pay";
import { SALON } from "@/lib/catalog";

type PaySearch = { pid?: string };

export const Route = createFileRoute("/pay/affirm")({
  validateSearch: (s: Record<string, unknown>): PaySearch => ({
    pid: typeof s.pid === "string" ? s.pid : undefined,
  }),
  component: AffirmPayPage,
});

function AffirmPayPage() {
  const { pid } = Route.useSearch();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingPay | null>(null);
  const [months, setMonths] = useState<(typeof AFFIRM_PLANS)[number]>(3);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = loadPending();
    setPending(p && p.id === pid ? p : p && !pid ? p : null);
  }, [pid]);

  if (!pending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f7f7f8] px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
          <p className="text-sm text-[#6b7280]">This Affirm checkout expired or was already paid.</p>
          <Button className="mt-4" onClick={() => void navigate({ to: "/" })}>
            Back to the salon
          </Button>
        </div>
      </main>
    );
  }

  const monthly = affirmMonthly(pending.amount, months);

  function confirm() {
    setBusy(true);
    void navigate({ to: "/pay/success", search: { pid: pending!.id } });
  }

  return (
    <main className="min-h-dvh bg-[#0b0b0c] text-white">
      <div className="mx-auto grid min-h-dvh max-w-5xl lg:grid-cols-[1fr_1.05fr]">
        <aside className="flex flex-col justify-between px-8 py-10">
          <div>
            <AffirmMark className="h-7 w-auto text-white" />
            <p className="mt-8 text-sm text-white/60">Pay over time at {SALON.name}</p>
            <p className="mt-2 font-serif text-5xl">{money(pending.amount)}</p>
            <p className="mt-4 max-w-sm text-sm text-white/60">{pending.description}</p>
          </div>
          <p className="text-xs text-white/40">Test mode · no credit check, no charge</p>
        </aside>

        <section className="flex items-center bg-[#f7f7f8] px-4 py-10 text-[#111] sm:px-10">
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.08)] sm:p-8">
            <p className="text-sm font-medium">Choose a plan</p>
            <ul className="mt-4 space-y-2">
              {AFFIRM_PLANS.map((n) => {
                const due = affirmMonthly(pending.amount, n);
                const on = months === n;
                return (
                  <li key={n}>
                    <button
                      type="button"
                      onClick={() => setMonths(n)}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm shadow-[var(--shadow-border)] ${on ? "bg-[#0b0b0c] text-white" : "bg-white hover:bg-[#f7f7f8]"}`}
                    >
                      <span>{n} months</span>
                      <span className="tabular-nums">{money(due)}/mo</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-sm text-[#6b7280]">
              {months} payments of {money(monthly)}. 0% APR in this test checkout.
            </p>
            <Button type="button" className="mt-5 w-full bg-[#4a30d9] text-white hover:bg-[#3d27b8]" disabled={busy} onClick={confirm}>
              {busy ? "Confirming…" : `Confirm ${money(monthly)}/mo`}
            </Button>
            <button
              type="button"
              className="mt-3 w-full text-center text-sm text-[#4a30d9]"
              onClick={() => window.location.assign(pending.cancelPath)}
            >
              Cancel
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
