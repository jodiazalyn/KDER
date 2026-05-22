# KDER Design System — Apple Liquid Glass

The aesthetic target for every surface in the KDER app. Modeled on Apple's iOS 26 Liquid Glass design language. Implemented via the [`liquidglass-tailwind`](https://www.npmjs.com/package/liquidglass-tailwind) plugin (already installed and wired in [tailwind.config.ts:111](../tailwind.config.ts)).

> **TL;DR for contributors:** prefer the plugin's semantic utilities (`glass-card`, `glass-btn`, `glass-nav`, `glass-modal`, `glass-input`) over hand-rolled `backdrop-blur-[8px] bg-white/[0.06] border border-white/[0.12] rounded-2xl ...` combos. The migration map below maps every existing pattern to its Liquid Glass equivalent.

---

## Table of contents
- [Philosophy](#philosophy)
- [Available utilities](#available-utilities)
- [Migration map (current → new)](#migration-map-current--new)
- [Surface taxonomy](#surface-taxonomy)
- [Color tokens](#color-tokens)
- [Corner radii](#corner-radii)
- [Motion](#motion)
- [Accessibility](#accessibility)
- [Anti-patterns](#anti-patterns)
- [What ships next (Phase 2)](#what-ships-next-phase-2)

---

## Philosophy

Five principles inherited from Apple's Liquid Glass language:

1. **Contextual transparency.** Surfaces are translucent and saturated, revealing blurred content beneath. Never fully opaque, never fully transparent.
2. **Floating controls.** Hierarchy comes from depth (multi-layer shadows + blur) and not from heavy borders.
3. **Harmonized squircle radii.** Every interactive surface uses the same generous corner-radius scale.
4. **Edge-to-edge content.** Chrome (navs, toolbars, action bars) is minimal and translucent; content fills the viewport.
5. **Subtle refraction.** A specular highlight sweep across the top of cards (`glass-shine`) simulates light bending through glass — the differentiator from basic glassmorphism.

---

## Available utilities

All from `liquidglass-tailwind`. Use these instead of hand-rolling combos.

### Component classes

| Class | Use for | Notes |
|---|---|---|
| `glass-card` | In-app card / tile | Default surface for stats, list items, compact panels |
| `glass-card-elevated` | Featured / hero card | Deeper blur + heavier shadow than `glass-card` |
| `glass-btn` | Primary button | Combine with `bg-{color}-500/25 border-{color}-400/20` for accent buttons |
| `glass-btn-secondary` | Secondary button | Lower opacity, less attention |
| `glass-btn-pill` | Pill-shaped button | Filter chips, segmented control items, dismiss buttons |
| `glass-nav` | Top nav / floating action bar / bottom dock | |
| `glass-modal` | Bottom sheets, modal dialogs, sheets that slide in | |
| `glass-input` | Text inputs, textareas, OTP boxes | |
| `glass-segment` + `glass-segment-item` + `glass-segment-item-active` | iOS-style segmented control | Use `glass-segment-item-active` on the selected item |
| `glass-shine` | Specular highlight (`::after` overlay) | Pair with `glass-card` / `glass-card-elevated` |
| `glass-shine-subtle` | Lower-intensity shine | For dense layouts where full shine would compete |

### Surface utilities (lower-level)

For surfaces that don't fit a component pattern (custom panels, overlays):

| Class | Blur amount |
|---|---|
| `glass-surface-sm` | 8px |
| `glass-surface` | 16px |
| `glass-surface-lg` | 24px |
| `glass-surface-xl` | 40px |

### Theme tokens

The plugin extends Tailwind's theme. Use these in arbitrary class values (`bg-glass-light`, `border-glass-border`, etc.):

| Token group | Members |
|---|---|
| `colors.glass.*` | `light` (rgba(255,255,255,.15)), `medium` (.10), `subtle` (.08), `strong` (.25), `dark` (rgba(0,0,0,.15)) |
| `colors.glass-border.*` | `DEFAULT` (.20), `subtle` (.10), `strong` (.30) |
| `borderRadius.glass*` | `glass-sm` (12px), `glass` (16px), `glass-lg` (24px), `glass-xl` (32px), `glass-pill` (9999px) |
| `boxShadow.glass*` | `glass`, `glass-lg`, `glass-elevated` |

---

## Migration map (current → new)

The codebase has ~103 hand-rolled `backdrop-blur-*` instances + scattered `bg-white/[0.06]` + custom border combos. Most map cleanly to a semantic component class:

| Current pattern | Replace with |
|---|---|
| `backdrop-blur-[8px] bg-white/[0.06] border border-white/[0.12] rounded-2xl` | `glass-card` |
| Same as above + heavier shadow / hero card | `glass-card-elevated glass-shine` |
| `backdrop-blur-[20px] bg-white/[0.10] border ...` on a sticky/floating bar | `glass-nav` |
| `backdrop-blur-[24px] bg-white/[0.10] border ...` on a bottom sheet / modal | `glass-modal` |
| `backdrop-blur-[8px] bg-white/[0.06] border ...` on inputs | `glass-input` |
| Existing `glass-surface` / `glass-surface-sm/lg/xl` raw use | Keep when truly generic surface; otherwise upgrade to a component class |
| Bouncy `bg-[#1B5E20] shadow-[0_0_20px_rgba(27,94,32,0.5)]` primary CTA | `glass-btn text-white bg-emerald-500/25 border-emerald-400/20` |
| Pill chips (status badges, fulfillment pills) | `glass-btn-pill` (when interactive) — keep raw bg utilities for read-only badges |
| Segmented tabs (Active / Completed / Declined on `/orders`) | `glass-segment` + `glass-segment-item` |

**Rule of thumb when migrating a component:**
1. Identify what the surface IS semantically (card / button / nav / modal / input / segment).
2. Replace the hand-rolled blur+bg+border+shadow stack with the matching `glass-*` component class.
3. Add `glass-shine` to cards/buttons that should catch light (heroes, primary CTAs).
4. Keep KDER's color tokens (`bg-emerald-500/25`, `border-emerald-400/20`, etc.) for tinting — the glass utilities are tint-agnostic.
5. Use the `rounded-glass-*` scale instead of mixed `rounded-2xl` / `rounded-3xl`.

---

## Surface taxonomy

**When picking between similar utilities:**

| Surface | Use |
|---|---|
| Static info panel (Recent Orders, Quick Stats) | `glass-card` |
| Featured / hero card (Streak Banner, Storefront Header) | `glass-card-elevated glass-shine` |
| Bottom-of-screen action bar (`<FloatingActionBar>`) | `glass-nav` |
| Top app bar / page header | `glass-nav` |
| Bottom sheet (CartSheet, ShareSheet, InstantPayoutSheet, PlateDetailSheet) | `glass-modal` |
| Centered modal dialog | `glass-modal` |
| Inline input field | `glass-input` |
| Tab bar (Active / Completed / Declined) | `glass-segment` |
| Dismiss / "Got it" / status pill | `glass-btn-pill` |
| Primary CTA ("Accept order $20") | `glass-btn` + accent color tint |
| Coachmark bubble | `glass-card-elevated glass-shine` |
| InfoTip popover content | `glass-card` |
| Toast (sonner) | `glass-modal` (themed via toaster options) |

---

## Color tokens

KDER's brand colors stay in [tailwind.config.ts](../tailwind.config.ts):

| Token | Hex | Usage |
|---|---|---|
| `kder.green.DEFAULT` | `#1B5E20` | Primary action tint (combine with `glass-btn`) |
| `kder.green.light` | `#2E7D32` | Hover/active variants |
| `kder.green.glow` | `rgba(46,125,50,0.6)` | Glow shadow (use sparingly) |
| `kder.dark` | `#0A0A0A` | App background substrate |
| `kder.cream` / `kder.paper` / `kder.ink` / `kder.ink-muted` / `kder.line` / `kder.mint` | (light marketing palette) | Public landing page only — do NOT use in-app |

For glass tints, use the plugin's tokens directly:
- `bg-glass-light` / `bg-glass-medium` / `bg-glass-subtle` / `bg-glass-strong` / `bg-glass-dark`
- `border-glass-border` / `border-glass-border-subtle` / `border-glass-border-strong`

For accent-tinted glass buttons, prefer Tailwind's color/opacity:
```html
<button class="glass-btn text-white bg-emerald-500/25 border-emerald-400/20">Accept</button>
<button class="glass-btn text-white bg-orange-500/25 border-orange-400/20">Pending</button>
<button class="glass-btn text-white bg-red-500/25 border-red-400/20">Decline</button>
```

---

## Corner radii

Standardize on the plugin's scale. Map of when to use which:

| Class | Pixels | Use for |
|---|---|---|
| `rounded-glass-sm` | 12px | Small inline elements (badges, chips, OTP boxes) |
| `rounded-glass` | 16px | Default for cards, inputs |
| `rounded-glass-lg` | 24px | Bottom sheets, modals, large cards |
| `rounded-glass-xl` | 32px | Featured / hero cards (used sparingly) |
| `rounded-glass-pill` | 9999px | Buttons (especially `glass-btn-pill`), avatar chips |

**Migrating from existing radii:** `rounded-2xl` → `rounded-glass-lg` in most cases; `rounded-3xl` → `rounded-glass-xl`; `rounded-full` → `rounded-glass-pill`.

---

## Motion

Three rules:

1. **Use spring physics for state transitions.** Linear `transition-all duration-200` feels mechanical. Use `framer-motion` springs:
   ```tsx
   <motion.div
     initial={{ y: 100, opacity: 0 }}
     animate={{ y: 0, opacity: 1 }}
     transition={{ type: "spring", stiffness: 400, damping: 30 }}
   />
   ```
2. **Standard spring presets** (use these constants project-wide once they live in code):
   - **Sheet entry/exit:** `{ stiffness: 400, damping: 30 }`
   - **Press feedback:** `{ stiffness: 600, damping: 35 }` — tight + snappy
   - **List item appear (stagger):** `{ stiffness: 300, damping: 25 }` with `delayChildren: 0.05`
3. **CSS still fine for hover/press tints** (color transitions, opacity fades). Springs are for transforms (translate/scale).

**For on-press feedback, prefer scale over color:** `active:scale-95 transition-transform duration-150` is the Apple-feel pattern. Already used in many components — keep it.

**Subtle hover lift on glass cards:** `hover:-translate-y-0.5 transition-all duration-300` — gives the floating effect.

---

## Accessibility

The plugin and our `globals.css` already wire two media queries globally — contributors generally don't need to do anything per-component:

| Preference | Behavior |
|---|---|
| `prefers-reduced-transparency: reduce` | All `.glass-surface*` and `.glass-green` fall back to solid `rgba(15,30,15,0.95)`, `backdrop-filter` is removed. Plugin's component classes (`glass-card` etc.) get equivalent treatment via the package. |
| `prefers-reduced-motion: reduce` | Global `*` selector caps animation/transition duration at 0.01ms (in [globals.css:64–71](../src/app/globals.css)). Springs become near-instant. |

**Per-component requirements:**
- Always pair translucent surfaces with sufficient text contrast (`text-white` over dark glass; verify with WCAG contrast checker if uncertain)
- Always provide visible focus rings on interactive glass elements (`focus-visible:ring-2 focus-visible:ring-emerald-400/40`)
- Use `aria-label` on icon-only buttons

---

## Anti-patterns

- **Glass on glass on glass** — max 2 layers of translucency stacked. Beyond that, the eye loses depth perception and contrast craters.
- **Heavy borders** — keep at 1px max, opacity ≤ 0.30. Use shadow for separation.
- **Inconsistent radii** — pick from the `rounded-glass-*` scale; don't introduce new `rounded-[19px]` arbitrary values.
- **Bouncy / flashy animations** — Apple Liquid Glass is calm. No bounces, no flips, no shimmer-on-everything.
- **Fully transparent backgrounds** — always carry some tint (min 0.04 opacity) so the surface registers as a discrete object.
- **Hard-coded `backdrop-blur-[8px]`** — use the plugin's named utilities so the system stays coherent.
- **Mixing radius scales** — don't pair `rounded-2xl` (16px) with `rounded-3xl` (24px) on sibling surfaces; pick one.
- **Forgetting the shine** — heroes feel flat without `glass-shine`.

---

## Complete migration inventory

Every page and component in the app, mapped to the phase it gets touched in. Nothing should be missed in the rollout.

### Three glass approaches currently coexist (cleanup needed)
1. **Hand-rolled inline** — `bg-white/[0.06] backdrop-blur-[8px] border ...` repeated across most components. Most code.
2. **Custom `<GlassSurface>` component** ([src/components/glass/GlassSurface.tsx](../src/components/glass/GlassSurface.tsx)) — defines 5 tiers, **currently unused** anywhere in src/. **Delete in Phase 2.**
3. **`liquidglass-tailwind` plugin** — installed, only the basic `glass-surface*` utilities used (8 occurrences). The semantic component classes (`glass-card`, `glass-btn`, etc.) are unused. **This is the destination.**

### Phase 2 — Primitives (`src/components/ui/`, 12 files)
Migrating these cascades to every screen. Single PR.

| File | Action |
|---|---|
| `coachmark.tsx` | bubble → `glass-card-elevated glass-shine` |
| `info-tip.tsx` | popover content → `glass-card` |
| `sheet.tsx` | bottom sheet wrapper → `glass-modal` |
| `dialog.tsx` | modal dialog → `glass-modal` |
| `floating-action-bar.tsx` | bottom dock → `glass-nav` |
| `button.tsx` | add `glass-btn` / `glass-btn-secondary` / `glass-btn-pill` variants alongside shadcn variants |
| `input.tsx` | text input → `glass-input` |
| `pull-to-refresh.tsx` | spinner pill → `glass-card` (subtle) |
| `page-transition.tsx` | confirm spring physics; tweak if linear |
| `skeleton.tsx` | shimmer using `glass-shine`-style overlay |
| `form.tsx` | field wrapper styling alignment |
| `label.tsx` | typography pass (no glass surface but check letter-spacing) |
| (sonner toast theming) | configure via `<Toaster />` toastOptions to match `glass-modal` |
| **DELETE** `src/components/glass/GlassSurface.tsx` | unused; superseded by plugin utilities |

### Phase 3 — Motion (cross-cutting)
Single PR. No new files; touches existing transitions everywhere.
- Replace linear `transition-all` with framer-motion springs on: sheets, coachmarks, list items, button press feedback
- Standard spring presets in a new `src/lib/motion.ts` constant export
- Loading-state shimmer via `glass-shine`
- Verify `prefers-reduced-motion` honors via globals.css (already wired)

### Phase 4 — Per-surface migration

Multiple PRs (one per surface group). Apply primitives + tokens.

#### 4a — Creator app shell + dashboard
| File | Notes |
|---|---|
| [src/app/(app)/layout.tsx](../src/app/%28app%29/layout.tsx) | App shell wrapper, BottomNav |
| [src/components/layout/BottomNav.tsx](../src/components/layout/BottomNav.tsx) | → `glass-nav` |
| [src/app/(app)/dashboard/page.tsx](../src/app/%28app%29/dashboard/page.tsx) | Dashboard composition |
| `src/components/dashboard/StorefrontHeader.tsx` | Hero header |
| `src/components/dashboard/ShareLinkCard.tsx` | → `glass-card-elevated glass-shine` (green-tinted) |
| `src/components/dashboard/QuickStats.tsx` | → `glass-card` |
| `src/components/dashboard/ActivePlatesPreview.tsx` | → `glass-card` |
| `src/components/dashboard/RecentOrders.tsx` | row items → `glass-card` (subtle) |
| `src/components/dashboard/StreakBanner.tsx` | → `glass-card-elevated glass-shine` |
| `src/components/dashboard/BadgeShelf.tsx` | badge tiles → `glass-card` |
| `src/components/dashboard/Leaderboard.tsx` | sheet → `glass-modal` |
| `src/components/dashboard/LeaderboardButton.tsx` | floating crown → `glass-btn-pill` |
| `src/components/dashboard/LeaderboardButtonLazy.tsx` | dynamic-import wrapper, no UI |

#### 4b — Orders flow
| File | Notes |
|---|---|
| [src/app/(app)/orders/page.tsx](../src/app/%28app%29/orders/page.tsx) | tabs → `glass-segment` |
| [src/app/(app)/orders/[id]/page.tsx](../src/app/%28app%29/orders/%5Bid%5D/page.tsx) | order detail |
| `src/components/orders/OrderCard.tsx` | → `glass-card` (pending: accent-tinted) |
| `src/components/orders/CountdownTimer.tsx` | inline pill → `glass-btn-pill` style |
| `src/components/orders/OrderMessages.tsx` | embedded chat → `glass-card` container |

#### 4c — Earnings + Stripe Connect
| File | Notes |
|---|---|
| [src/app/(app)/earnings/page.tsx](../src/app/%28app%29/earnings/page.tsx) | composition |
| `src/components/earnings/EarningsView.tsx` | top-level layout |
| `src/components/earnings/BalanceHero.tsx` | → `glass-card-elevated glass-shine` (the hero of the page) |
| `src/components/earnings/KycBanner.tsx` | → `glass-card` (orange/red-tinted) |
| `src/components/earnings/FailedPayoutBanner.tsx` | → `glass-card` (red-tinted) |
| `src/components/earnings/InstantPayoutSheet.tsx` | → `glass-modal` |
| `src/components/earnings/PayoutScheduleSheet.tsx` | → `glass-modal` |
| `src/components/earnings/OrderTransferDrawer.tsx` | → `glass-modal` |
| `src/components/earnings/StandardPayoutButton.tsx` | → `glass-btn` |
| `src/components/earnings/ExpressLoginLinkButton.tsx` | → `glass-btn-secondary` |
| `src/components/earnings/PayoutHistoryList.tsx` | rows → `glass-card` (subtle) |
| `src/components/earnings/TransactionRow.tsx` | row item |
| `src/components/earnings/LifetimeStatsCard.tsx` | → `glass-card` |
| `src/components/earnings/CollapsibleSection.tsx` | accordion shell |
| `src/components/earnings/HowEarningsWorkAccordion.tsx` | FAQ rows |

#### 4d — Plate listing + creation
| File | Notes |
|---|---|
| [src/app/(app)/listings/page.tsx](../src/app/%28app%29/listings/page.tsx) | listing index |
| [src/app/(app)/listings/new/page.tsx](../src/app/%28app%29/listings/new/page.tsx) | new plate route |
| [src/app/(app)/listings/[id]/edit/page.tsx](../src/app/%28app%29/listings/%5Bid%5D/edit/page.tsx) | edit route |
| `src/components/listings/PlateForm.tsx` | inputs → `glass-input`, container cards → `glass-card` |
| `src/components/listings/PlateCard.tsx` | listing tile → `glass-card` |
| `src/components/listings/MediaUpload.tsx` | upload area → `glass-card` (subtle, dashed) |
| `src/components/listings/CategoryChips.tsx` | chips → `glass-btn-pill` |
| `src/components/listings/FulfillmentPicker.tsx` | option group → `glass-segment` |
| `src/components/listings/QuantityStepper.tsx` | stepper → `glass-btn-pill` (compact) |

#### 4e — Messaging
| File | Notes |
|---|---|
| [src/app/(app)/messages/page.tsx](../src/app/%28app%29/messages/page.tsx) | inbox |
| [src/app/(app)/messages/[threadId]/page.tsx](../src/app/%28app%29/messages/%5BthreadId%5D/page.tsx) | thread |
| `src/components/messages/ConversationRow.tsx` | row → `glass-card` (subtle) |
| `src/components/messages/ChatThread.tsx` | bubbles → `glass-card` (sender vs receiver tint) |
| `src/components/messages/ComposeSheet.tsx` | → `glass-modal` |

#### 4f — Settings
| File | Notes |
|---|---|
| [src/app/(app)/settings/page.tsx](../src/app/%28app%29/settings/page.tsx) | section cards → `glass-card`, save bar → `glass-nav` (already uses `<FloatingActionBar>`) |

#### 4g — Storefront (customer-facing) + checkout
| File | Notes |
|---|---|
| [src/app/[handle]/page.tsx](../src/app/%5Bhandle%5D/page.tsx) | server-rendered storefront |
| `src/app/[handle]/storefront-client.tsx` | client wrapper |
| `src/components/storefront/CreatorHeader.tsx` | → `glass-card-elevated glass-shine` |
| `src/components/storefront/PlateTile.tsx` | → `glass-card` (the IG-style grid tiles) |
| `src/components/storefront/PlateCard.tsx` | row variant |
| `src/components/storefront/PlateDetailSheet.tsx` | → `glass-modal` |
| `src/components/storefront/CategoryFilter.tsx` | → `glass-segment` |
| `src/components/storefront/CartSheet.tsx` | → `glass-modal` |
| `src/components/storefront/CheckoutSheet.tsx` | → `glass-modal` |
| `src/components/storefront/ActiveOrderBanner.tsx` | → `glass-card` (accent-tinted, sticky) |
| [src/app/order-confirmation/page.tsx](../src/app/order-confirmation/page.tsx) | confirmation → `glass-card-elevated glass-shine` |

#### 4h — Auth + onboarding
| File | Notes |
|---|---|
| [src/app/(auth)/signup/page.tsx](../src/app/%28auth%29/signup/page.tsx) | phone input |
| [src/app/(auth)/signup/verify/page.tsx](../src/app/%28auth%29/signup/verify/page.tsx) | OTP |
| [src/app/(auth)/signup/waitlist/page.tsx](../src/app/%28auth%29/signup/waitlist/page.tsx) | waitlist |
| [src/app/onboarding/customer/page.tsx](../src/app/onboarding/customer/page.tsx) | customer onboarding |
| [src/app/onboarding/handle/page.tsx](../src/app/onboarding/handle/page.tsx) | handle picker |
| [src/app/onboarding/profile/page.tsx](../src/app/onboarding/profile/page.tsx) | display name + email + bio |
| [src/app/onboarding/terms/page.tsx](../src/app/onboarding/terms/page.tsx) | terms accept |
| `src/components/auth/PhoneInput.tsx` | → `glass-input` |
| `src/components/auth/OtpInput.tsx` | each box → `glass-input` (compact) |
| `src/components/onboarding/PhotoUpload.tsx` | upload → `glass-card` (subtle, dashed) |
| `src/components/onboarding/ProgressDots.tsx` | dots — typography/stroke tweaks only |

#### 4i — Marketing landing (light theme)
The landing page intentionally uses the cream/paper light palette, NOT the dark glass aesthetic. Glass utilities still apply where appropriate but with the light token set (`bg-glass-light` over the cream backdrop). Phase 4i is mostly a verification pass to ensure consistency.

| File | Notes |
|---|---|
| [src/app/page.tsx](../src/app/page.tsx) | landing composition |
| `src/components/landing/MarketingNav.tsx` | sticky → `glass-nav` (light variant) |
| `src/components/landing/MarketingFooter.tsx` | footer |
| `src/components/landing/Hero.tsx` | hero composition |
| `src/components/landing/HandleClaimInput.tsx` | input → light `glass-input` variant |
| `src/components/landing/MissionAnchor.tsx` | typography section |
| `src/components/landing/TrustStrip.tsx` | marquee chips |
| `src/components/landing/HowItWorks.tsx` | step cards → light `glass-card` |
| `src/components/landing/ListingShowcase.tsx` | tiles → light `glass-card` |
| `src/components/landing/ListingChip.tsx` | metadata chips |
| `src/components/landing/CreatorProgram.tsx` | section copy + cards |
| `src/components/landing/PayoutShowcase.tsx` | hero card + phone mockup |
| `src/components/landing/BuiltForHouston.tsx` | photo + caption |
| `src/components/landing/Testimonials.tsx` | ⚠️ STILL HAS PLACEHOLDER QUOTES — remove or replace before any rollout |
| `src/components/landing/PaymentMethods.tsx` | logo strip |
| `src/components/landing/CreatorCards.tsx` | metal-card forward-positioning section |
| `src/components/landing/PhoneFrame.tsx` | device chrome wrapper |
| `src/components/landing/phones/*` | StorefrontPhoneScreen / OrderPhoneScreen / EarningsPhoneScreen / PhoneStatusBar — these mock the in-app dark glass UI; should migrate alongside Phase 4a–4f for visual parity |

#### 4j — Static legal pages
| File | Notes |
|---|---|
| [src/app/privacy/page.tsx](../src/app/privacy/page.tsx) | text + section cards → light `glass-card` |
| [src/app/terms/page.tsx](../src/app/terms/page.tsx) | same |
| [src/app/sms-policy/page.tsx](../src/app/sms-policy/page.tsx) | same |

#### 4k — Shared + cross-cutting
| File | Notes |
|---|---|
| `src/components/shared/ShareSheet.tsx` | bottom sheet → `glass-modal` (already 8 backdrop-blur uses) |
| `src/components/shared/CopyLinkButton.tsx` | three variants (icon, compact, share) → `glass-btn` family |
| `src/components/shared/AiDraftButton.tsx` | inline button → `glass-btn-secondary` (subtle) |

### Phase 5 — Icons + typography polish
Cross-cutting; no new files. Touches every screen lightly.
- Standardize lucide-react sizes (16/18/20/24 only) and stroke weights (1.5 default, 2 for emphasis)
- Letter-spacing pass on display headings (`tracking-[-0.02em]` for 24px+)
- Ensure SF Pro fallbacks render consistently across browsers
- Verify color contrast on all glass surfaces (WCAG AA minimum)

### Cleanup checklist
- [ ] Delete `src/components/glass/GlassSurface.tsx` (unused, superseded by plugin)
- [ ] Replace placeholder `<Testimonials />` on landing — real quotes or remove component
- [ ] Audit pass: zero `backdrop-blur-[Npx]` arbitrary values remain in `src/` after Phases 2 + 4
- [ ] Audit pass: zero `bg-white/[0.0X]` + `border-white/[0.YY]` combos remain — all replaced by `glass-*` utilities or `bg-glass-*` tokens
- [ ] Verify `prefers-reduced-motion` + `prefers-reduced-transparency` still honor on every surface

### Phase totals
- **Phase 2:** 12 ui/ files + 1 deletion + sonner theming ≈ **1 day**, 1 PR
- **Phase 3:** motion constants + transitions across primitives ≈ **half a day**, 1 PR
- **Phase 4:** **63 files** across 11 sub-groups ≈ **3–4 days**, 4–6 PRs (group sub-phases by surface so each PR is reviewable)
- **Phase 5:** typography + icon polish ≈ **half a day**, 1 PR
- **Total:** ~6 days of focused work across ~8 PRs, fully accounting for every page and component in the app

After all phases land, every surface in `src/` has been touched. The cleanup checklist above is the verifiable proof.
