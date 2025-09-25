import { Router } from "express";
import { autumnHandler } from "autumn-js/express";
import { auth } from "../lib/auth.js";

const router = Router();

// Create autumn handler with authentication
const handler = autumnHandler({
  identify: async (req) => {
    try {
      const session = await auth.api.getSession({
        headers: req.headers,
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
