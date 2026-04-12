# KDER — Product Requirements Document: Creator Share Sheet
**Section 5.9 — Creator Share Sheet (Addendum to PRD v13)**
**Status:** MVP
**Priority:** Must

---

## 5.9 Creator Share Sheet

### Overview

The Creator Share Sheet is a native-style bottom sheet that enables creators to share their storefront link (`kder.com/[handle]`) directly to social media, messaging apps, email, and productivity tools. Sharing is the primary growth lever — every share is a potential order.

**Core Principle:** A creator should be able to share their storefront link to any platform in two taps or fewer.

### User Story

*As a food creator, I want to share my storefront link to social media, messaging apps, and email so that I can drive orders without manually copying and pasting.*

**Acceptance Criteria:**
- Given I tap "Share Your Link" or "Share My Link", Then a bottom sheet appears with sharing options
- Given I tap a social app (WhatsApp, X, Facebook), Then that app opens with my link pre-filled
- Given I tap Messages, Then my SMS app opens with a pre-composed message containing my link
- Given I tap Email, Then my mail client opens with subject and body pre-filled
- Given I tap Copy Link, Then my link is copied to clipboard with visual confirmation
- Given I tap "More...", Then the native OS share sheet opens with all installed apps
- Given I tap outside the sheet or the close button, Then the sheet dismisses

### Trigger Points

The Share Sheet is triggered from every location where a share/copy action exists:

| Location | Button Label | Component |
|----------|-------------|-----------|
| My Store dashboard — Share Card | "Share Your Link" | `ShareLinkCard.tsx` |
| My Store dashboard — Recent Orders empty state | "Share My Link" | `RecentOrders.tsx` |
| Orders page — Active tab empty state | "Share My Link" | `OrdersPage` |
| Copy icon on Share Card | Icon button | `ShareLinkCard.tsx` |

### Share Sheet Layout

**Bottom sheet** — slides up from bottom, 40vh max height, `glass-surface-lg`, `rounded-t-3xl`

**Components (top to bottom):**

1. **Handle bar** — centered 40px gray bar for drag-to-dismiss affordance
2. **Header** — "Share your storefront" in `text-lg font-bold text-white`
3. **Link preview row** — `kder.com/[handle]` displayed in glass-surface-sm pill + copy icon button with "Copied!" feedback
4. **App grid** — horizontally scrollable row of circular app icons (56px each) with labels below
5. **"More..." button** — triggers native `navigator.share()` API as fallback for all other installed apps

### App Grid — Sharing Destinations

| App | Icon Source | Deep Link / URL Scheme | Pre-filled Content |
|-----|-----------|----------------------|-------------------|
| Messages | `lucide-react: MessageCircle` | `sms:?body={shareText}` | Share text with link |
| WhatsApp | Custom SVG | `https://wa.me/?text={encodedShareText}` | Share text with link |
| Instagram | Custom SVG | Copy link + toast "Link copied! Open Instagram to share." | Clipboard (IG has no URL share scheme) |
| X (Twitter) | Custom SVG | `https://x.com/intent/tweet?text={encodedText}&url={url}` | Share text + URL separately |
| Facebook | Custom SVG | `https://www.facebook.com/sharer/sharer.php?u={encodedUrl}` | URL only (FB pulls OG meta) |
| Email | `lucide-react: Mail` | `mailto:?subject={subject}&body={encodedShareText}` | Subject + body with link |
| Copy Link | `lucide-react: Link` | `navigator.clipboard.writeText()` | Full URL to clipboard |
| More... | `lucide-react: Share2` | `navigator.share()` | Title + text + URL via Web Share API |

### Share Text Template

```
Check out my plates on KDER!

Order from me: https://kder.com/{handle}

Feed the city. Own your income.
```

**Email subject:** `Order from me on KDER`

### Business Rules

| ID | Rule |
|----|------|
| BR-011 | Share text must always include the full storefront URL |
| BR-012 | Instagram share copies link to clipboard (no direct share URL exists) |
| BR-013 | "More..." option must use native Web Share API when available |
| BR-014 | Share Sheet must be accessible (WCAG 2.1 AA) — all icons labeled, keyboard navigable |

### Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Sheet opens in < 200ms |
| Accessibility | All app icons have `aria-label`; sheet traps focus; close on Escape |
| Mobile | Touch targets ≥ 48×48px for all app icons |
| Fallback | If `navigator.share()` unavailable, "More..." button hidden |
| Analytics | Future: track which share destination is tapped most (Phase 2) |

### UX Specifications

**Glass styling:** `glass-surface-lg` — `bg-white/[0.14] backdrop-blur-[24px] border border-white/[0.22] rounded-t-3xl`

**App icon styling:**
- Container: 56×56px, `rounded-2xl`, brand-colored background
- Label: `text-[10px] text-white/60` centered below
- Tap: `active:scale-90` (150ms)

**Link preview:**
- Glass pill: `glass-surface-sm`, `rounded-full`, `px-4 py-2`
- Copy button: green checkmark feedback for 2.5s (reuse existing pattern)

**Micro-interactions:**
| Interaction | Trigger | Animation | Duration |
|-------------|---------|-----------|----------|
| Sheet open | Tap share button | Slide up from bottom, spring physics | 300ms |
| Sheet close | Tap outside / close / escape | Slide down | 200ms |
| App icon tap | Touch | `active:scale-90` | 150ms |
| Copy feedback | Clipboard write | Icon → checkmark, text → "Copied!" | 2500ms |

### Out of Scope — MVP

- Share analytics / tracking which platform gets most taps
- Custom OG image per storefront (uses default KDER OG)
- Deep link to specific plate (shares storefront, not individual listing)
- QR code generation

### Product Decision

| # | Decision | Resolution |
|---|----------|-----------|
| 11 | Share destinations | SMS, WhatsApp, Instagram, X, Facebook, Email, Copy Link, native share |
| 12 | Instagram share | Copy to clipboard + toast (no URL scheme for direct sharing) |
| 13 | Share text | Includes storefront URL + tagline — no emojis in URL params |
