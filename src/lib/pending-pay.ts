import { startStripePay } from "./stripe-pay";
import { useSalon } from "./store";
import type { PendingPay } from "./types";

export type { PendingPay };

const KEY = "eb-stripe-pending";
const DONE = "eb-stripe-done";
const inflight = new Set<string>();

export function claimPending(id: string) {
  if (wasPaid(id)) return "done" as const;
  if (inflight.has(id)) return "busy" as const;
  inflight.add(id);
  return "go" as const;
}

export function releasePending(id: string) {
  inflight.delete(id);
}

export function savePending(p: PendingPay) {
  sessionStorage.setItem(KEY, JSON.stringify(p));
}

export function loadPending(): PendingPay | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingPay;
  } catch {
    return null;
  }
}

export function clearPending() {
  sessionStorage.removeItem(KEY);
}

export function markPaid(pending: { id: string; amount: number; provider?: "stripe" | "affirm" }) {
  sessionStorage.setItem(
    DONE,
    JSON.stringify({ id: pending.id, amount: pending.amount, provider: pending.provider ?? "stripe" }),
  );
}

export function wasPaid(id: string) {
  const last = lastPaid();
  return last?.id === id;
}

export function lastPaid(): { id: string; amount: number; provider: "stripe" | "affirm" } | null {
  const raw = sessionStorage.getItem(DONE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id?: string; amount?: number; provider?: "stripe" | "affirm" };
    if (!parsed.id) return null;
    return { id: parsed.id, amount: parsed.amount ?? 0, provider: parsed.provider === "affirm" ? "affirm" : "stripe" };
  } catch {
    return raw ? { id: raw, amount: 0, provider: "stripe" } : null;
  }
}

export async function beginStripeCheckout(input: Omit<PendingPay, "id" | "provider">) {
  const pending: PendingPay = { ...input, id: crypto.randomUUID(), provider: "stripe" };
  savePending(pending);
  useSalon.getState().setPendingPay(pending);
  const successPath = `/pay/success?pid=${pending.id}`;
  const result = await startStripePay({
    data: {
      amountCents: Math.max(50, Math.round(input.amount * 100)),
      description: input.description,
      successPath,
      cancelPath: input.cancelPath,
      metadata: { pid: pending.id, kind: input.kind },
    },
  });
  if (result.mode === "live") {
    window.location.assign(result.url);
    return { mode: "live" as const };
  }
  return { mode: "demo" as const, pid: pending.id };
}

export function beginAffirmCheckout(input: Omit<PendingPay, "id" | "provider">) {
  const pending: PendingPay = { ...input, id: crypto.randomUUID(), provider: "affirm" };
  savePending(pending);
  useSalon.getState().setPendingPay(pending);
  return { pid: pending.id };
}

export const STRIPE_TEST_CARD = "4242424242424242";
export const STRIPE_DECLINE_CARD = "4000000000000002";
export const STRIPE_FUNDS_CARD = "4000000000009995";

export function cardOutcome(digits: string) {
  const d = digits.replace(/\D/g, "");
  if (d === STRIPE_DECLINE_CARD) return "declined" as const;
  if (d === STRIPE_FUNDS_CARD) return "insufficient" as const;
  if (d === STRIPE_TEST_CARD || d.length === 16) return "ok" as const;
  return "invalid" as const;
}
