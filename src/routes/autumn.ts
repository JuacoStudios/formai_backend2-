import { Router } from "express";
import { autumnHandler } from "autumn-js/express";
import { auth } from "../lib/auth.js";

const router = Router();

// Create autumn handler with authentication
const handler = autumnHandler({
  identify: async (req) => {
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

      const session = await auth.api.getSession({
        headers,
      });
      if (!session?.user) {
        return null;
      }
      return {
        customerId: session.user.id,
        customerData: {
          name: session.user.name,
          email: session.user.email,
        },
      };
    } catch (error) {
      return null;
    }
  },
});

// Apply the handler to all routes
router.use("/", handler);

export { router as autumnRouter };
