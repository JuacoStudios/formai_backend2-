import { Router } from "express";
import { stripe } from "../stripe.js";
import { upsertPro } from "../db.js";

export const paymentsRouter = Router();

paymentsRouter.post("/create-payment-intent", async (req, res) => {
  try {
    const { userId, amount } = req.body as { userId?: string; amount?: number };
    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const pi = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: { userId },
    });

    return res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id });
  } catch (err: any) {
    console.error("/create-payment-intent error", err);
    return res.status(500).json({ error: "Failed to create PaymentIntent" });
  }
});

// Optional: Stripe webhook
paymentsRouter.post("/webhook/stripe", async (req, res) => {
  let event = req.body;
  const sig = req.headers["stripe-signature"] as string | undefined;

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
      const buf = (req as any).rawBody as Buffer; // populated by index.ts
      event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }
  } catch (err: any) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as any;
      const userId = pi?.metadata?.userId;
      if (userId) {
        upsertPro(userId);
        console.log("Entitlement set via webhook for", userId, pi.id);
      }
    }
  } catch (e) {
    console.error("Webhook handling error", e);
  }

  res.json({ received: true });
});