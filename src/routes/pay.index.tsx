import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { StripeMark } from "@/components/stripe-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { money } from "@/lib/format";
import { SALON } from "@/lib/catalog";
import { cardOutcome, loadPending, STRIPE_TEST_CARD, type PendingPay } from "@/lib/pending-pay";
import { useSalon } from "@/lib/store";

type PaySearch = { pid?: string };

export const Route = createFileRoute("/pay/")({
  validateSearch: (s: Record<string, unknown>): PaySearch => ({
    pid: typeof s.pid === "string" ? s.pid : undefined,
  }),
  component: PayPage,
});

function formatCard(raw: string) {
  return raw
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
    .trim();
}

function PayPage() {
  const { pid } = Route.useSearch();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingPay | null>(null);
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [zip, setZip] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = loadPending() ?? useSalon.getState().pendingPay;
    setPending(p && p.id === pid ? p : p && !pid ? p : null);
  }, [pid]);

  const digits = useMemo(() => card.replace(/\D/g, ""), [card]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    const [mm, yy] = exp.split("/");
    const month = Number(mm);
    const year = Number(yy);
    if (!month || month < 1 || month > 12 || !year) {
      setError("Enter a valid expiry.");
      return;
    }
    if (cvc.replace(/\D/g, "").length < 3) {
      setError("Enter the CVC.");
      return;
    }
    const outcome = cardOutcome(digits);
    if (outcome === "invalid") {
      setError("Enter a valid card number.");
      return;
    }
    if (outcome === "declined") {
      setError("Your card was declined.");
      return;
    }
    if (outcome === "insufficient") {
      setError("Your card has insufficient funds.");
      return;
    }
    setBusy(true);
    void navigate({ to: "/pay/success", search: { pid: pending.id } });
  }

  if (!pending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f6f9fc] px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
          <p className="text-sm text-[#6b7c93]">This Stripe checkout expired or was already paid.</p>
          <Button className="mt-4" onClick={() => void navigate({ to: "/" })}>
            Back to the salon
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f6f9fc] text-[#1a1f36]">
      <div className="mx-auto grid min-h-dvh max-w-5xl lg:grid-cols-[1fr_1.05fr]">
        <aside className="flex flex-col justify-between bg-[#0a0908] px-8 py-10 text-[#f4efe6]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#c6a25a]">{SALON.name}</p>
            <p className="mt-8 text-sm text-[#c6c0b6]">Pay {pending.kind === "deposit" ? "deposit" : "Enlightened Beauty"}</p>
            <p className="mt-2 font-serif text-5xl">{money(pending.amount)}</p>
            <p className="mt-4 max-w-sm text-sm text-[#c6c0b6]">{pending.description}</p>
          </div>
          <p className="text-xs text-[#8a8378]">Test mode · cards are not charged</p>
        </aside>

        <section className="flex items-center px-4 py-10 sm:px-10">
          <form onSubmit={submit} className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.08)] sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm font-medium">Pay with card</p>
              <StripeMark className="h-6 w-auto text-[#635bff]" />
            </div>
            <Field label="Card number">
              <Input
                value={card}
                onChange={(e) => setCard(formatCard(e.target.value))}
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="ACCT-000015"
              />
            </Field>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Field label="Expiry">
                <Input
                  value={exp}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                  }}
                  placeholder="MM/YY"
                  autoComplete="cc-exp"
                />
              </Field>
              <Field label="CVC">
                <Input
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="123"
                  autoComplete="cc-csc"
                />
              </Field>
              <Field label="ZIP">
                <Input value={zip} onChange={(e) => setZip(e.target.value.slice(0, 10))} placeholder="54143" />
              </Field>
            </div>
            {error ? <p className="mt-3 text-sm text-[#df1b41]">{error}</p> : null}
            <Button type="submit" className="mt-5 w-full bg-[#635bff] text-white hover:bg-[#5851ea]" disabled={busy}>
              Pay {money(pending.amount)}
            </Button>
            <p className="mt-4 text-center text-[11px] text-[#6b7c93]">
              Test cards: {formatCard(STRIPE_TEST_CARD)} · 4000 0000 0000 0002 declines
            </p>
            <button
              type="button"
              className="mt-3 w-full text-center text-sm text-[#635bff]"
              onClick={() => {
                window.location.assign(pending.cancelPath);
              }}
            >
              Cancel
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
