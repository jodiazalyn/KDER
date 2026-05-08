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

## What ships next (Phase 2)

The next PR migrates these primitives to the new system. Reviewers should expect to see them touched:

| File | Current | After Phase 2 |
|---|---|---|
| [src/components/ui/coachmark.tsx](../src/components/ui/coachmark.tsx) | hand-rolled bubble | `glass-card-elevated glass-shine` |
| [src/components/ui/info-tip.tsx](../src/components/ui/info-tip.tsx) | Radix popover w/ hand-rolled bg | `glass-card` content |
| [src/components/ui/floating-action-bar.tsx](../src/components/ui/floating-action-bar.tsx) | custom blur + border | `glass-nav` |
| [src/components/ui/sheet.tsx](../src/components/ui/sheet.tsx) | Radix Dialog w/ hand-rolled bg | `glass-modal` |
| [src/components/ui/dialog.tsx](../src/components/ui/dialog.tsx) | shadcn dialog | `glass-modal` |
| [src/components/ui/button.tsx](../src/components/ui/button.tsx) | shadcn variants | + `glass-btn` / `glass-btn-secondary` / `glass-btn-pill` variants |
| [src/components/ui/input.tsx](../src/components/ui/input.tsx) | shadcn input | `glass-input` |
| Toast (sonner integration) | default theme | themed via toaster options to match `glass-modal` |

**Estimated:** 1 day, single PR. Cascades to every screen because these primitives are used everywhere.

After Phase 2, **Phase 3** standardizes motion (framer-motion springs across sheets, press feedback, list animations), **Phase 4** migrates per-surface (Dashboard, Orders, Earnings, Storefront, PlateForm, Settings), and **Phase 5** polishes icons + typography.
