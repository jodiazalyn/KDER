# KDER — Product Overview & Launch Readiness

*Internal reference for the KDER team. Audited against the `main` branch.*
*Last updated: 2026-06-08.*

---

## 1. What KDER is

KDER is a mobile-first (PWA) marketplace that formalizes Houston's informal food
economy. Home cooks, bakers, and food creators who currently sell through
Instagram DMs and Cash App get a real storefront, order and payment
infrastructure, and instant payouts — and **keep 90% of every plate.**

**Positioning:** *"Your kitchen. Your club. Feed the city. Own your income."*

**The legal model (everyone should understand this):** every transaction is a
**member-to-member service agreement**, not a retail food sale. This is the
mechanism that lets us formalize cottage/informal food businesses. When talking
to creators, partners, or regulators, we are a platform for food *clubs* and
member service agreements — not a restaurant ordering app.

## 2. Who it's for

- **Creators** (supply side — the focus of creator acquisition): home
  cooks/bakers running a "food club."
- **Customers** (demand side): neighbors ordering plates, pickup or delivery,
  with no account friction.

## 3. Tech stack

Next.js 15 (App Router) + React 19 · Supabase (Postgres, Auth, Realtime, RLS,
**Storage** for all media) · Stripe Connect Express · Twilio Verify (OTP) +
Twilio SMS · SendGrid (email) · Anthropic SDK (Mia / AI) · Uber Direct
(delivery) · deployed as a PWA. Design: custom "Liquid Glass" system — dark
street-luxury in-app, bright cream marketing site.

---

## 4. Launch readiness — status by feature

This section is the source of truth for **what we can promise is working.**
Status was verified by reading the actual route handlers and libraries, not the
UI. Three statuses:

- **LIVE** — wired to real services with real DB persistence. Production-ready
  once the relevant env keys are set.
- **PARTIAL** — mostly real, with a caveat worth knowing.
- **STUBBED** — not functional; returns placeholder data. Do **not** promise.

| Feature | Status | Notes |
|---|---|---|
| Checkout (Stripe) | **LIVE** | Real `stripe.checkout.sessions.create` with platform-fee + creator transfer split; order persisted to Supabase. |
| Stripe Connect onboarding | **LIVE** | Real Express account creation + KYC account links; status synced via webhook. |
| Payouts — instant & standard | **LIVE** | Real `stripe.payouts.create`; instant payout fee grossing applied; idempotency enforced. |
| Stripe webhook | **LIVE** | Signature verified; payment + payout lifecycle events upserted to DB. |
| Orders (accept/ready/complete/decline) | **LIVE** | Real Supabase reads/writes; SMS quick-actions functional. |
| Catering (inquiry → quote → deposit → booking → balance) | **LIVE** | Real DB throughout; auto balance charge via Stripe off-session; cron jobs run real logic. |
| Auth / OTP | **LIVE** | Twilio Verify via Supabase Auth. **No backdoor/test codes.** |
| Anonymous customer checkout | **LIVE** | Real `signInAnonymously` + member upsert; IP rate-limited. |
| Creator/member onboarding | **LIVE** | Real Supabase writes (sessionStorage is in-session draft staging only). |
| Listings (plates) | **LIVE** | Real Supabase persistence; photos → Supabase Storage; video → signed upload URLs. Active listings gated on Stripe KYC. |
| Messaging | **LIVE** | Supabase Realtime; inbound SMS webhook (signature-verified); SendGrid email notifications; media to Supabase Storage. |
| Mia — AI pricing agent | **LIVE** | Real Anthropic calls (web-search tool enabled). Chats persisted for signed-in users; anonymous chats are ephemeral. |
| AI Describe (listing copy) | **LIVE** | Real Anthropic call; auth-only; rate-limited (30/hr/creator). |
| Beta waitlist | **LIVE** | Real capture to `waitlist_signups`; handle uniqueness enforced; signup webhook (Slack/Discord/Zapier). |
| Uber Direct delivery | **PARTIAL** | Real OAuth + quote + booking API. **Defaults to SANDBOX** — needs `UBER_DIRECT_ENV=prod` + valid prod credentials for real couriers. |
| **Ratings ("Vibe Engine")** | **STUBBED** | `POST /api/v1/ratings` is a TODO — returns an empty `rating_id`, writes nothing. **Do not promise ratings/reviews at launch** until this is built. |

### The one real blocker: Ratings

`src/app/api/v1/ratings/route.ts` is a stub. If reviews/ratings are in scope for
the launch story, this needs a backend before go-live. Everything else listed as
LIVE is functional.

---

## 5. Production launch checklist (env + config)

Every LIVE feature depends on its keys being set in the production environment.
Before launch, confirm all of the following are configured in prod:

- **Supabase** — `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  service-role key. *(Note: if the URL is empty or contains "placeholder," the
  app runs in a local-dev bypass that skips auth. This is dev-only — never ship
  with a placeholder URL.)*
- **Stripe** — secret key + `STRIPE_WEBHOOK_SECRET`, Connect configured.
- **Twilio** — account SID, auth token, phone number. *(If unset, SMS silently
  no-ops as `demo_skipped` — dev convenience only, not a prod mode.)*
- **SendGrid** — for email notifications.
- **Anthropic** — `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`). Missing
  key returns 503; Mia/AI Describe will be unavailable but won't crash.
- **Uber Direct** — client ID/secret **and** `UBER_DIRECT_ENV=prod` for real
  deliveries (otherwise sandbox).

**Key takeaway:** the platform is not a demo or a prototype — it is wired
end-to-end to live services. Launch readiness is gated on (a) production
credentials being in place, (b) the Uber Direct env flip, and (c) deciding
whether Ratings is in or out of the launch scope.
