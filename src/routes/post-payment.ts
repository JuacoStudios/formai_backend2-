import { Router } from "express";
import { stripe } from "../stripe.js";
import { upsertPro } from "../db.js";

export const postPaymentRouter = Router();

postPaymentRouter.post("/post-payment/mark-pro", async (req, res) => {
  try {
    const { userId, paymentIntentId } = req.body as { userId?: string; paymentIntentId?: string };
    if (!userId || !paymentIntentId) {
      return res.status(400).json({ error: "Missing userId or paymentIntentId" });
    }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") {
      return res.status(400).json({ error: "Payment not succeeded", status: pi.status });
    }
    const metaUserId = (pi.metadata as any)?.userId;
    if (metaUserId && metaUserId !== userId) {
      return res.status(400).json({ error: "User mismatch" });
    }

    upsertPro(userId);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("/post-payment/mark-pro error", err);
    return res.status(500).json({ error: "Failed to mark PRO" });
  }
});