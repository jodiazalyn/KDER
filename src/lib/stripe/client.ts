import Stripe from "stripe";

// Use a placeholder key when STRIPE_SECRET_KEY is unset (dev environments
// without Stripe configured) so module import doesn't throw. Any real API
// call will 401 — callers (like loadEarningsData) catch per-section and
// degrade gracefully rather than crashing the page.
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "sk_dev_unconfigured";

export const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: "2026-03-25.dahlia",
  typescript: true,
});

export const PLATFORM_FEE_PERCENT = Number(
  process.env.STRIPE_PLATFORM_FEE_PERCENT || "10"
);
