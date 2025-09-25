import { Router } from "express";
import { Autumn as autumn } from "autumn-js";
import { auth } from "../lib/auth.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    // Convert Express headers to Headers object
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        headers.set(key, value.join(', '));
      }
    });

    const session = await auth.api.getSession({ headers });
    
    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let body = {};
    try {
      body = req.body;
    } catch {}

    const { returnUrl } = body as { returnUrl?: string };

    try {
      const result = await autumn.customers.billingPortal(session.user.id, {
        return_url: returnUrl || undefined,
      } as any);

      const url = result?.data?.url;

      if (!url) {
        return res.status(500).json({
          error: "Failed to generate billing portal URL"
        });
      }

      return res.json({ url });
    } catch (err: any) {
      return res.status(500).json({
        error: "Failed to generate billing portal URL",
        message: err.message
      });
    }
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { router as billingPortalRouter };
