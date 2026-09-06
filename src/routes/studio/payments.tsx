import { createFileRoute } from "@tanstack/react-router";
import { AffirmMark } from "@/components/affirm-mark";
import { StripeMark } from "@/components/stripe-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEPOSIT_RATE } from "@/lib/catalog";
import { money, whenLabel } from "@/lib/format";
import { STRIPE_DECLINE_CARD, STRIPE_FUNDS_CARD, STRIPE_TEST_CARD } from "@/lib/pending-pay";
import { needsDeposit, useSalon } from "@/lib/store";

export const Route = createFileRoute("/studio/payments")({ component: PaymentsPage });

function formatTest(digits: string) {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

const PRESETS: { label: string; value: number | null }[] = [
  { label: "Never", value: null },
  { label: "$50+", value: 50 },
  { label: "$75+", value: 75 },
  { label: "$100+", value: 100 },
  { label: "$150+", value: 150 },
  { label: "Always", value: 0 },
];

function PaymentsPage() {
  const sales = useSalon((s) => s.sales);
  const clients = useSalon((s) => s.clients);
  const services = useSalon((s) => s.services);
  const depositMin = useSalon((s) => s.depositMin);
  const setDepositMin = useSalon((s) => s.setDepositMin);
  const affirmEnabled = useSalon((s) => s.affirmEnabled);
  const affirmMin = useSalon((s) => s.affirmMin);
  const setAffirm = useSalon((s) => s.setAffirm);
  const cards = sales.filter((s) => s.method === "card" || s.method === "affirm");
  const held = services.filter((s) => needsDeposit(s.price, depositMin)).length;

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Payments</p>
      <h1 className="font-serif text-3xl font-medium">Payments</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Card deposits, shop, gifts, and the register all run through Stripe Checkout. Affirm covers pay-over-time on tickets at or above the floor. Cash and gift cards stay in-house.
      </p>

      <section className="mt-6 rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Online booking</p>
        <h2 className="mt-1 font-serif text-2xl">Deposits by price</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Stripe takes {Math.round(DEPOSIT_RATE * 100)}% when the service meets the floor. Cheaper visits pay in the chair.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant={depositMin === p.value ? "ink" : "outline"}
              onClick={() => setDepositMin(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="mt-4 flex max-w-xs items-center gap-2">
          <Input
            type="number"
            min={0}
            step={5}
            value={depositMin ?? ""}
            placeholder="Off"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") setDepositMin(null);
              else setDepositMin(Number(raw));
            }}
          />
          <span className="shrink-0 text-sm text-muted-foreground">and up</span>
        </div>
        <p className="mt-3 text-sm">
          {depositMin == null
            ? "No deposits. Every booking skips the card."
            : depositMin === 0
              ? "Every service takes a deposit."
              : `${held} of ${services.length} services take a deposit (${money(depositMin)} and up).`}
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {services.map((s) => {
            const due = needsDeposit(s.price, depositMin);
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{s.name}</span>
                <span className="shrink-0 text-muted-foreground">{due ? `hold ${money(Math.round(s.price * DEPOSIT_RATE))}` : "in chair"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Pay over time</p>
            <h2 className="mt-1 font-serif text-2xl">Affirm</h2>
          </div>
          <AffirmMark className="h-6 w-auto text-[#4a30d9]" />
        </div>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Guests can split shop, gift cards, deposits, and register tickets into monthly payments. Affirm’s live floor is typically $50.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant={affirmEnabled ? "ink" : "outline"} onClick={() => setAffirm({ enabled: true })}>
            Offer Affirm
          </Button>
          <Button size="sm" variant={!affirmEnabled ? "ink" : "outline"} onClick={() => setAffirm({ enabled: false })}>
            Hide Affirm
          </Button>
        </div>
        <div className="mt-4 flex max-w-xs items-center gap-2">
          <Input
            type="number"
            min={0}
            step={5}
            value={affirmMin}
            onChange={(e) => setAffirm({ min: Number(e.target.value) || 0 })}
          />
          <span className="shrink-0 text-sm text-muted-foreground">minimum</span>
        </div>
        <p className="mt-3 text-sm">
          {affirmEnabled ? `Affirm shows on totals ${money(affirmMin)} and up.` : "Affirm is hidden on the site and register."}
        </p>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between gap-3">
            <StripeMark className="h-6 w-auto text-[#635bff]" />
            <Badge>Test mode</Badge>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            No live secret key is set, so guests use Stripe test checkout in this preview. Publish with{" "}
            <span className="text-foreground">STRIPE_SECRET_KEY</span> to send them to Stripe-hosted Checkout.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">Pays</span> {formatTest(STRIPE_TEST_CARD)}
            </li>
            <li>
              <span className="text-muted-foreground">Declines</span> {formatTest(STRIPE_DECLINE_CARD)}
            </li>
            <li>
              <span className="text-muted-foreground">Insufficient</span> {formatTest(STRIPE_FUNDS_CARD)}
            </li>
          </ul>
        </section>
        <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">On the card</p>
          <p className="mt-1 font-serif text-4xl">{money(cards.reduce((s, x) => s + x.total, 0))}</p>
          <p className="mt-1 text-sm text-muted-foreground">{cards.length} card + Affirm tickets</p>
        </section>
      </div>

      <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        {cards.length === 0 ? (
          <li className="px-5 py-8 text-sm text-muted-foreground">No Stripe payments yet. Book a deposit or run a card ticket.</li>
        ) : (
          cards.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{s.items.map((i) => i.name).join(", ")}</p>
                <p className="text-sm text-muted-foreground">
                  {clients.find((c) => c.id === s.clientId)?.name ?? "Walk-in"} · {whenLabel(s.at)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-serif text-2xl">{money(s.total)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {s.method === "affirm" ? "Affirm" : s.stripeId ? `pi_${s.stripeId.slice(0, 12)}` : "card"}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
