import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AffirmMark } from "@/components/affirm-mark";
import { AffirmPromo } from "@/components/affirm-promo";
import { PublicShell } from "@/components/site-header";
import { StripeMark } from "@/components/stripe-mark";
import { Button } from "@/components/ui/button";
import { affirmEligible } from "@/lib/affirm";
import { money } from "@/lib/format";
import { beginAffirmCheckout, beginStripeCheckout } from "@/lib/pending-pay";
import { useSalon } from "@/lib/store";

export const Route = createFileRoute("/shop")({ component: ShopPage });

function ShopPage() {
  const navigate = useNavigate();
  const products = useSalon((s) => s.products);
  const visitor = useSalon((s) => s.visitor);
  const affirmEnabled = useSalon((s) => s.affirmEnabled);
  const affirmMin = useSalon((s) => s.affirmMin);

  async function buy(p: (typeof products)[number], provider: "stripe" | "affirm") {
    try {
      const base = {
        amount: p.price,
        description: p.name,
        cancelPath: "/shop" as const,
      };
      if (provider === "affirm") {
        const result =
          p.category === "Gift"
            ? beginAffirmCheckout({
                ...base,
                kind: "gift",
                gift: { amount: p.price, from: visitor?.name ?? "Guest", to: "Someone you like" },
              })
            : beginAffirmCheckout({ ...base, kind: "shop", productId: p.id });
        await navigate({ to: "/pay/affirm", search: { pid: result.pid } });
        return;
      }
      if (p.category === "Gift") {
        const result = await beginStripeCheckout({
          ...base,
          kind: "gift",
          gift: { amount: p.price, from: visitor?.name ?? "Guest", to: "Someone you like" },
        });
        if (result.mode === "demo") await navigate({ to: "/pay", search: { pid: result.pid } });
        return;
      }
      const result = await beginStripeCheckout({ ...base, kind: "shop", productId: p.id });
      if (result.mode === "demo") await navigate({ to: "/pay", search: { pid: result.pid } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout could not start.");
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Retail</p>
        <h1 className="mt-1 font-serif text-4xl font-medium">Take the salon home</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          The same oil, wash, and polish we use in the chair. Gift cards never expire. Pay with Stripe or Affirm.
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <StripeMark className="h-3.5 w-auto" />
            Card
          </span>
          <span className="inline-flex items-center gap-2">
            <AffirmMark className="h-3.5 w-auto text-[#4a30d9]" />
            Pay over time from {money(affirmMin)}
          </span>
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => {
            const soldOut = p.category !== "Gift" && p.stock <= 0;
            const canAffirm = !soldOut && affirmEligible(p.price, affirmEnabled, affirmMin);
            return (
              <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
                <img src={p.image} alt="" className="framed aspect-square w-full object-cover" />
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{p.category}</p>
                  <h2 className="mt-1 font-medium">{p.name}</h2>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{p.description}</p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="font-serif text-2xl">{money(p.price)}</p>
                      {canAffirm ? <AffirmPromo amount={p.price} /> : null}
                    </div>
                    <Button size="sm" disabled={soldOut} onClick={() => void buy(p, "stripe")}>
                      {p.category === "Gift" ? "Stripe" : soldOut ? "Sold out" : "Stripe"}
                    </Button>
                  </div>
                  {canAffirm ? (
                    <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => void buy(p, "affirm")}>
                      <AffirmMark className="h-3.5 w-auto" />
                      Pay over time
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </PublicShell>
  );
}
