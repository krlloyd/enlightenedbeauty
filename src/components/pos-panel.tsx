import { useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TAX_RATE } from "@/lib/catalog";
import { money } from "@/lib/format";
import { clientById, useSalon } from "@/lib/store";
import { beginAffirmCheckout, beginStripeCheckout } from "@/lib/pending-pay";
import { affirmEligible } from "@/lib/affirm";
import { AffirmMark } from "./affirm-mark";
import type { CartLine, PayMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input, NativeSelect } from "./ui/input";
import { Field } from "./ui/label";
import { Separator } from "./ui/separator";
import { StripeMark } from "./stripe-mark";

export function PosPanel({ appointmentId }: { appointmentId?: string }) {
  const navigate = useNavigate();
  const appointments = useSalon((s) => s.appointments);
  const clients = useSalon((s) => s.clients);
  const products = useSalon((s) => s.products);
  const services = useSalon((s) => s.services);
  const checkout = useSalon((s) => s.checkout);
  const affirmEnabled = useSalon((s) => s.affirmEnabled);
  const affirmMin = useSalon((s) => s.affirmMin);

  const linked = appointments.find((a) => a.id === appointmentId);
  const [clientId, setClientId] = useState(linked?.clientId ?? "");
  const [items, setItems] = useState<CartLine[]>(() => {
    if (!linked) return [];
    const svc = services.find((s) => s.id === linked.serviceId);
    if (!svc) return [];
    return [{ kind: "service", refId: svc.id, name: svc.name, qty: 1, price: svc.price }];
  });
  const [tip, setTip] = useState(0);
  const [method, setMethod] = useState<PayMethod>("card");
  const [giftCode, setGiftCode] = useState("");
  const [tab, setTab] = useState<"services" | "retail">("services");

  const [paying, setPaying] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = subtotal + tax + tip;

  function addLine(line: CartLine) {
    setItems((curr) => {
      const hit = curr.find((x) => x.kind === line.kind && x.refId === line.refId);
      if (hit) return curr.map((x) => (x === hit ? { ...x, qty: x.qty + 1 } : x));
      return [...curr, line];
    });
  }

  function setQty(idx: number, qty: number) {
    setItems((curr) => curr.flatMap((x, i) => (i !== idx ? [x] : qty <= 0 ? [] : [{ ...x, qty }])));
  }

  async function pay() {
    if (method === "card" || method === "affirm") {
      setPaying(true);
      try {
        if (method === "affirm") {
          if (!affirmEligible(total, affirmEnabled, affirmMin)) {
            toast.error(`Affirm starts at ${money(affirmMin)}.`);
            setPaying(false);
            return;
          }
          const result = beginAffirmCheckout({
            kind: "pos",
            amount: total,
            description: items.map((i) => `${i.qty}× ${i.name}`).join(", "),
            cancelPath: "/studio/pos",
            checkout: {
              clientId: clientId || undefined,
              appointmentId: linked?.id,
              items,
              tip,
              method: "affirm",
              giftCode,
            },
          });
          await navigate({ to: "/pay/affirm", search: { pid: result.pid } });
          return;
        }
        const result = await beginStripeCheckout({
          kind: "pos",
          amount: total,
          description: items.map((i) => `${i.qty}× ${i.name}`).join(", "),
          cancelPath: "/studio/pos",
          checkout: {
            clientId: clientId || undefined,
            appointmentId: linked?.id,
            items,
            tip,
            method: "card",
            giftCode,
          },
        });
        if (result.mode === "demo") {
          await navigate({ to: "/pay", search: { pid: result.pid } });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Stripe could not start checkout.");
        setPaying(false);
      }
      return;
    }
    const result = checkout({
      clientId: clientId || undefined,
      appointmentId: linked?.id,
      items,
      tip,
      method,
      giftCode,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Paid ${money(result.sale.total)}`);
    setItems([]);
    setTip(0);
    if (linked) void navigate({ to: "/studio/calendar" });
  }

  const retail = products.filter((p) => p.category !== "Gift");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section>
        <div className="mb-4 flex gap-2">
          <Button size="sm" variant={tab === "services" ? "ink" : "outline"} onClick={() => setTab("services")}>
            Services
          </Button>
          <Button size="sm" variant={tab === "retail" ? "ink" : "outline"} onClick={() => setTab("retail")}>
            Retail
          </Button>
        </div>
        {tab === "services" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => addLine({ kind: "service", refId: s.id, name: s.name, qty: 1, price: s.price })}
                className="rounded-xl bg-card px-4 py-3 text-left shadow-[var(--shadow-border)] transition-shadow duration-150 hover:shadow-[var(--shadow-border-hover)]"
              >
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-muted-foreground">{money(s.price)}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {retail.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={p.stock <= 0}
                onClick={() => addLine({ kind: "product", refId: p.id, name: p.name, qty: 1, price: p.price })}
                className={cn(
                  "rounded-xl bg-card px-4 py-3 text-left shadow-[var(--shadow-border)] transition-shadow duration-150 hover:shadow-[var(--shadow-border-hover)]",
                  p.stock <= 0 && "opacity-40",
                )}
              >
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">
                  {money(p.price)} · {p.stock} in stock
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="h-fit rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-serif text-2xl">Ticket</h2>
        <Field label="Client" className="mt-4">
          <NativeSelect value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Walk-in</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {linked ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Linked visit · {clientById(clients, linked.clientId)?.name}
          </p>
        ) : null}

        <ul className="mt-4 divide-y divide-border">
          {items.length === 0 ? (
            <li className="py-6 text-sm text-muted-foreground">Tap a service or product to start a ticket.</li>
          ) : (
            items.map((line, i) => (
              <li key={`${line.kind}-${line.refId}-${i}`} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground">{money(line.price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setQty(i, line.qty - 1)}>
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-5 text-center text-sm tabular-nums">{line.qty}</span>
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setQty(i, line.qty + 1)}>
                    <Plus className="size-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setQty(i, 0)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>

        <Separator className="my-3" />
        <Field label="Tip">
          <div className="flex flex-wrap gap-2">
            {[0, 5, 10, 15, 20].map((n) => (
              <Button key={n} type="button" size="sm" variant={tip === n ? "ink" : "outline"} onClick={() => setTip(n)}>
                {n === 0 ? "None" : money(n)}
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Pay with" className="mt-3">
          <div className="flex flex-wrap gap-2">
            {(["card", "affirm", "cash", "gift"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={method === m ? "ink" : "outline"}
                disabled={m === "affirm" && !affirmEligible(total, affirmEnabled, affirmMin)}
                onClick={() => setMethod(m)}
              >
                {m === "card" ? "Stripe" : m === "affirm" ? "Affirm" : m === "cash" ? "Cash" : "Gift card"}
              </Button>
            ))}
          </div>
        </Field>
        {method === "gift" ? (
          <Field label="Gift code" className="mt-3">
            <Input value={giftCode} onChange={(e) => setGiftCode(e.target.value.toUpperCase())} placeholder="EB-KATE" />
          </Field>
        ) : null}

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{money(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tax 5.5%</dt>
            <dd className="tabular-nums">{money(tax)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tip</dt>
            <dd className="tabular-nums">{money(tip)}</dd>
          </div>
          <div className="flex justify-between pt-2 font-medium">
            <dt>Total</dt>
            <dd className="font-serif text-2xl tabular-nums">{money(total)}</dd>
          </div>
        </dl>
        <Button className="mt-4 w-full" variant="ink" onClick={() => void pay()} disabled={items.length === 0 || paying}>
          {method === "card" ? (
            <span className="flex items-center gap-2">
              <StripeMark className="h-3.5 w-auto" />
              {paying ? "Opening Stripe…" : `Charge ${money(total)}`}
            </span>
          ) : method === "affirm" ? (
            <span className="flex items-center gap-2">
              <AffirmMark className="h-3.5 w-auto" />
              {paying ? "Opening Affirm…" : `Pay over time · ${money(total)}`}
            </span>
          ) : (
            `Take payment · ${money(total)}`
          )}
        </Button>
      </aside>
    </div>
  );
}
