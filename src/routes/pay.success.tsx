import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AffirmMark } from "@/components/affirm-mark";
import { StripeMark } from "@/components/stripe-mark";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { clearPending, claimPending, lastPaid, loadPending, markPaid, releasePending, wasPaid } from "@/lib/pending-pay";
import { confirmStripeSession } from "@/lib/stripe-pay";
import { depositFor, useSalon } from "@/lib/store";

type SuccessSearch = { pid?: string; session_id?: string };

export const Route = createFileRoute("/pay/success")({
  validateSearch: (s: Record<string, unknown>): SuccessSearch => ({
    pid: typeof s.pid === "string" ? s.pid : undefined,
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: PaySuccessPage,
});

function PaySuccessPage() {
  const { pid, session_id } = Route.useSearch();
  const book = useSalon((s) => s.book);
  const checkout = useSalon((s) => s.checkout);
  const buyProduct = useSalon((s) => s.buyProduct);
  const buyGift = useSalon((s) => s.buyGift);
  const [state, setState] = useState<"working" | "ok" | "fail">("working");
  const [message, setMessage] = useState("Confirming Stripe payment…");
  const [amount, setAmount] = useState(0);
  const [paidVia, setPaidVia] = useState<"stripe" | "affirm">("stripe");
  const [next, setNext] = useState("/visits");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const stored = useSalon.getState().pendingPay;
      const pending = loadPending() ?? stored;
      if (!pending || (pid && pending.id !== pid)) {
        const last = lastPaid();
        if (last && (!pid || last.id === pid)) {
          setAmount(last.amount);
          setPaidVia(last.provider);
          setState("ok");
          setMessage(last.provider === "affirm" ? "Affirm plan confirmed." : "Stripe payment received.");
          return;
        }
        setState("fail");
        setMessage("We could not find this checkout.");
        return;
      }
      if (wasPaid(pending.id) || claimPending(pending.id) !== "go") {
        setAmount(pending.amount);
        setState("ok");
        setMessage("Payment already recorded.");
        return;
      }
      if (session_id) {
        const live = await confirmStripeSession({ data: { sessionId: session_id } });
        if (!live.paid) {
          releasePending(pending.id);
          setState("fail");
          setMessage("Stripe has not captured this payment yet.");
          return;
        }
      }
      const viaAffirm = pending.provider === "affirm";
      const method = viaAffirm ? "affirm" : "card";
      setPaidVia(viaAffirm ? "affirm" : "stripe");
      if (cancelled) return;
      setAmount(pending.amount);

      if (pending.kind === "deposit" && pending.book) {
        const booked = book(pending.book);
        if (!booked.ok) {
          releasePending(pending.id);
          setState("fail");
          setMessage(booked.error);
          return;
        }
        checkout({
          clientId: booked.appointment.clientId,
          appointmentId: booked.appointment.id,
          items: [
            {
              kind: "service",
              refId: pending.book.serviceId,
              name: `${pending.description}`,
              qty: 1,
              price: depositFor(pending.book.serviceId),
            },
          ],
          tip: 0,
          method,
          stripeId: session_id ?? pending.id,
          fulfill: false,
        });
        setNext("/visits");
      } else if (pending.kind === "pos" && pending.checkout) {
        const paid = checkout({ ...pending.checkout, method, stripeId: session_id ?? pending.id });
        if (!paid.ok) {
          releasePending(pending.id);
          setState("fail");
          setMessage(paid.error);
          return;
        }
        setNext("/studio/pos");
      } else if (pending.kind === "gift" && pending.gift) {
        buyGift(pending.gift.amount, pending.gift.from, pending.gift.to, method);
        setNext("/shop");
      } else if (pending.kind === "shop" && pending.productId) {
        const paid = buyProduct(pending.productId, 1, undefined, method);
        if (!paid.ok) {
          releasePending(pending.id);
          setState("fail");
          setMessage(paid.error);
          return;
        }
        setNext("/shop");
      } else {
        setState("fail");
        setMessage("Missing payment details.");
        return;
      }

      markPaid(pending);
      clearPending();
      useSalon.getState().setPendingPay(null);
      setState("ok");
      setMessage(viaAffirm ? "Affirm plan confirmed." : "Stripe payment received.");
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [pid, session_id, book, checkout, buyGift, buyProduct]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[#f6f9fc] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
        {paidVia === "affirm" ? (
          <AffirmMark className="mx-auto h-6 w-auto text-[#4a30d9]" />
        ) : (
          <StripeMark className="mx-auto h-6 w-auto text-[#635bff]" />
        )}
        <h1 className="mt-6 font-serif text-3xl">{state === "fail" ? "Payment did not go through" : state === "ok" ? "Paid" : "Paying…"}</h1>
        <p className="mt-2 text-sm text-[#6b7c93]">{message}</p>
        {state === "ok" ? <p className="mt-3 font-serif text-4xl">{money(amount)}</p> : null}
        {state !== "working" ? (
          <Button asChild className="mt-6" variant="ink">
            <a href={next}>Continue</a>
          </Button>
        ) : null}
      </div>
    </main>
  );
}
