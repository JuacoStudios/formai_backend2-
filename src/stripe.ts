import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || "server/.env" });

// Use test key for development, live key for production
const stripeKey = process.env.NODE_ENV === 'production' 
  ? process.env.STRIPE_LIVE_KEY 
  : process.env.STRIPE_TEST_KEY;

if (!stripeKey) {
  throw new Error("STRIPE_TEST_KEY or STRIPE_LIVE_KEY is missing in server/.env");
}

export const stripe = new Stripe(stripeKey, {
  apiVersion: "2025-08-27.basil",
});