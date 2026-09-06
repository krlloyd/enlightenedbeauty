import { createServerFn } from "@tanstack/react-start";

export type StripePayInput = {
  amountCents: number;
  description: string;
  successPath: string;
  cancelPath: string;
  metadata: Record<string, string>;
};

export type StripePayResult =
  | { mode: "demo" }
  | { mode: "live"; url: string; sessionId: string };

export const startStripePay = createServerFn({ method: "POST" })
  .validator((d: StripePayInput) => d)
  .handler(async ({ data }): Promise<StripePayResult> => {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) return { mode: "demo" };

    const { default: Stripe } = await import("stripe");
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const incoming = new URL(request.url);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? incoming.host;
    const proto = request.headers.get("x-forwarded-proto") ?? incoming.protocol.replace(":", "") ?? "https";
    const origin = `${proto}://${host}`;

    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: data.amountCents,
            product_data: {
              name: data.description,
              images: [`${origin}/logo-light.png`],
            },
          },
        },
      ],
      success_url: `${origin}${data.successPath}${data.successPath.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${data.cancelPath}`,
      metadata: data.metadata,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { mode: "live", url: session.url, sessionId: session.id };
  });

export const confirmStripeSession = createServerFn({ method: "POST" })
  .validator((d: { sessionId: string }) => d)
  .handler(async ({ data }) => {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) return { paid: false as const, reason: "no-key" };
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.retrieve(data.sessionId);
    return {
      paid: session.payment_status === "paid" || session.status === "complete",
      amountCents: session.amount_total ?? 0,
      metadata: (session.metadata ?? {}) as Record<string, string>,
    };
  });
