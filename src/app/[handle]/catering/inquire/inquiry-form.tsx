"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send, X, Check } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { TimePicker12h } from "@/components/ui/time-picker-12h";

/**
 * Customer-facing catering inquiry form.
 *
 * Date picker is a native <input type="date"> with `min` set to the
 * earliest legal date (today + max-lead-time of pre-selected items).
 * Blacked-out dates can't be enforced in the native picker — we do a
 * second check on submit and surface the error inline.
 */

interface BlackoutRow {
  kind: "one_off" | "recurring";
  blackout_date: string | null;
  weekday: number | null;
}

interface ListingRow {
  id: string;
  name: string;
  price: number;
  photos: string[];
  kind: string;
  catering_pricing_mode: "per_head" | "flat" | null;
  catering_min_guests: number | null;
  catering_max_guests: number | null;
  catering_lead_time_hours: number | null;
  catering_fulfillment: string[];
  catering_inclusions: string | null;
  catering_inclusion_groups: Record<string, string[]> | null;
}

interface Props {
  handle: string;
  creatorId: string;
  creatorName: string;
  creatorPhoto: string | null;
  listings: ListingRow[];
  blackouts: BlackoutRow[];
  preSelectedIds: string[];
}

/** Today's date as YYYY-MM-DD in local time. */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format raw digits as the user types: "3235550123" → "(323) 555-0123".
 *  Mirrors CheckoutSheet's pattern so the two forms feel consistent. */
function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function InquiryForm({
  handle,
  creatorId,
  creatorName,
  creatorPhoto,
  listings,
  blackouts,
  preSelectedIds,
}: Props) {
  const router = useRouter();
  const currentUser = useCurrentUser();

  // Guest fields — only used when there's no currentUser. Matches the
  // CheckoutSheet pattern so unauthenticated customers can submit an
  // inquiry without going through a separate signup. On submit we POST
  // to /api/v1/auth/anon-customer first to register a real Supabase
  // anon session, then submit the inquiry.
  const [guestName, setGuestName] = useState("");
  const [guestPhoneRaw, setGuestPhoneRaw] = useState("");
  const guestPhoneDigits = guestPhoneRaw.replace(/\D/g, "");
  // Email is collected for everyone (logged-in users may not have one
  // on file yet — checkout does the same backfill). Optional but
  // strongly encouraged.
  const [email, setEmail] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(preSelectedIds)
  );
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [venueType, setVenueType] = useState<"residence" | "venue" | "other" | "">("");
  const [indoorOutdoor, setIndoorOutdoor] = useState<"indoor" | "outdoor" | "mixed" | "">("");
  const [needsServer, setNeedsServer] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [earliestSetup, setEarliestSetup] = useState("");
  const [kitchenAvailable, setKitchenAvailable] = useState<"yes" | "no" | "">("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Derived: earliest legal event date ─────────────────────
  // Today + max lead-time across the items the customer picked. If
  // they haven't picked any, fall back to today (any future date OK).
  const minDate = useMemo(() => {
    if (selectedIds.size === 0) return todayIso();
    const picked = listings.filter((l) => selectedIds.has(l.id));
    const maxLeadHours = Math.max(
      0,
      ...picked.map((l) => l.catering_lead_time_hours ?? 0)
    );
    const ms = Date.now() + maxLeadHours * 60 * 60 * 1000;
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, [listings, selectedIds]);

  // Set of blacked-out specific dates (one-off) for client-side
  // pre-submit validation. Recurring weekdays are checked at submit
  // time too.
  const oneOffBlackouts = useMemo(
    () =>
      new Set(
        blackouts.filter((b) => b.kind === "one_off" && b.blackout_date).map(
          (b) => b.blackout_date as string
        )
      ),
    [blackouts]
  );
  const recurringBlackoutWeekdays = useMemo(
    () =>
      new Set(
        blackouts
          .filter((b) => b.kind === "recurring" && b.weekday !== null)
          .map((b) => b.weekday as number)
      ),
    [blackouts]
  );

  const dateError = useMemo(() => {
    if (!eventDate) return null;
    if (eventDate < minDate) {
      return "Date is inside the creator's lead-time window.";
    }
    if (oneOffBlackouts.has(eventDate)) {
      return "Creator marked this date unavailable.";
    }
    const dt = new Date(eventDate + "T00:00:00");
    if (recurringBlackoutWeekdays.has(dt.getDay())) {
      return "Creator doesn't take bookings on this day of the week.";
    }
    return null;
  }, [eventDate, minDate, oneOffBlackouts, recurringBlackoutWeekdays]);

  // ── Guest count range from picks ───────────────────────────
  const guestRange = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const picked = listings.filter((l) => selectedIds.has(l.id));
    const min = Math.max(0, ...picked.map((l) => l.catering_min_guests ?? 0));
    // Max = smallest of all maxes (since every picked item must accept this count)
    const maxes = picked
      .map((l) => l.catering_max_guests)
      .filter((v): v is number => typeof v === "number");
    const max = maxes.length > 0 ? Math.min(...maxes) : null;
    return { min, max };
  }, [listings, selectedIds]);

  const guestNum = parseInt(guestCount, 10);
  const guestError = useMemo(() => {
    if (!guestCount) return null;
    if (!Number.isInteger(guestNum) || guestNum <= 0) return "Must be a number.";
    if (guestRange) {
      if (guestRange.min > 0 && guestNum < guestRange.min) {
        return `Your picks need at least ${guestRange.min} guests.`;
      }
      if (guestRange.max && guestNum > guestRange.max) {
        return `Your picks only serve up to ${guestRange.max} guests.`;
      }
    }
    return null;
  }, [guestCount, guestNum, guestRange]);

  // ── Canonical "can submit" ─────────────────────────────────
  // Guests need name + valid 10-digit phone before they can submit
  // (mirrors CheckoutSheet's guest-checkout gate). Logged-in users
  // skip that check.
  const guestFieldsValid =
    !!currentUser ||
    (guestName.trim().length > 0 && guestPhoneDigits.length === 10);
  const canSubmit =
    !!eventDate &&
    !dateError &&
    !!guestCount &&
    !guestError &&
    guestFieldsValid &&
    !submitting;

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // Anon-customer gate: when the visitor isn't signed in, register
      // a Supabase anon session FIRST so the inquiry route's
      // auth.getUser() resolves with a real user.id. Same pattern as
      // CheckoutSheet's guest checkout — no OTP friction, just name +
      // phone.
      if (!currentUser) {
        const anonRes = await fetch("/api/v1/auth/anon-customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: guestName.trim(),
            phone: guestPhoneDigits,
          }),
        });
        const anonJson = await anonRes.json();
        if (!anonRes.ok) {
          const code =
            typeof anonJson?.code === "string" ? ` [${anonJson.code}]` : "";
          toast.error(
            `${anonJson?.error || "Couldn't start your inquiry. Try again."}${code}`
          );
          setSubmitting(false);
          return;
        }
      }

      const trimmedEmail = email.trim();
      const res = await fetch("/api/v1/catering/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator_id: creatorId,
          event_date: eventDate,
          event_time: eventTime || null,
          event_end_time: eventEndTime || null,
          guest_count: guestNum,
          event_address: eventAddress.trim() || null,
          event_venue_type: venueType || null,
          indoor_outdoor: indoorOutdoor || null,
          needs_server: needsServer,
          needs_setup: needsSetup,
          earliest_setup_time: earliestSetup || null,
          kitchen_available:
            kitchenAvailable === "yes"
              ? true
              : kitchenAvailable === "no"
                ? false
                : null,
          allergies: allergies.trim() || null,
          notes: notes.trim() || null,
          pre_selected_listing_ids: Array.from(selectedIds),
          customer_email: trimmedEmail || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || "Couldn't submit. Try again.");
        return;
      }
      toast.success("Inquiry sent! The creator will reply with a quote.");
      router.push(`/${encodeURIComponent(handle)}`);
    } catch {
      toast.error("Couldn't submit. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0A0A0A] pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.10] bg-[#0A0A0A]/80 px-4 py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="glass-btn-pill flex h-11 w-11 items-center justify-center text-white/70 hover:text-white active:scale-90"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-white">
            Catering inquiry
          </h1>
          <p className="truncate text-xs text-white/50">
            to {creatorName}
          </p>
        </div>
        {creatorPhoto && (
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
            <Image src={creatorPhoto} alt="" fill className="object-cover" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4">
        <div className="mx-auto max-w-lg space-y-6">
          {/* Contact info — first thing the customer sees. Authed users
              skip the name/phone inputs (we already have those on file)
              but email is collected for everyone since we backfill
              members.email on submit. Mirrors the CheckoutSheet pattern. */}
          <section aria-labelledby="contact-label">
            <span
              id="contact-label"
              className="mb-2 block text-sm font-medium text-white/60"
            >
              {currentUser ? "Your contact info" : "Your contact info"}
            </span>
            {currentUser ? (
              <div className="glass-card px-4 py-3">
                <p className="text-xs text-white/50">Inquiring as</p>
                <p className="mt-0.5 text-sm font-medium text-white">
                  {currentUser.display_name}
                </p>
                {currentUser.phone && (
                  <p className="text-xs text-white/40">
                    {currentUser.phone}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) =>
                    setGuestName(e.target.value.slice(0, 40))
                  }
                  placeholder="Your name *"
                  autoComplete="name"
                  className="glass-input h-12 w-full rounded-xl px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={guestPhoneRaw}
                  onChange={(e) =>
                    setGuestPhoneRaw(formatPhoneInput(e.target.value))
                  }
                  placeholder="Phone — (323) 555-0123 *"
                  autoComplete="tel"
                  className="glass-input h-12 w-full rounded-xl px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                />
                <p className="text-xs text-white/35">
                  The creator will text you here with their quote.
                </p>
              </div>
            )}
            {/* Email — collected for all users so we can route order
                updates + the quote PDF via email regardless of auth. */}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (recommended — for quote + receipts)"
              autoComplete="email"
              inputMode="email"
              className="glass-input mt-2 h-12 w-full rounded-xl px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
          </section>

          {/* Selected items panel */}
          {selectedIds.size > 0 && (
            <section>
              <label className="mb-2 block text-sm font-medium text-white/60">
                Items you&apos;re interested in
              </label>
              <ul className="space-y-1.5">
                {listings
                  .filter((l) => selectedIds.has(l.id))
                  .map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white">{l.name}</p>
                        <p className="text-[11px] text-white/40">
                          ${l.price.toFixed(0)}
                          {l.catering_pricing_mode === "per_head" ? "/guest" : " flat"}
                        </p>
                        {/* Inclusion summary — first 3 groups, first
                            item per group, joined with · — keeps the
                            row scannable. */}
                        {(() => {
                          const groups = l.catering_inclusion_groups || {};
                          const summary = Object.entries(groups)
                            .filter(([, items]) => Array.isArray(items) && items.length > 0)
                            .slice(0, 3)
                            .map(([group, items]) => `${group}: ${items[0]}`)
                            .join(" · ");
                          return summary ? (
                            <p className="mt-0.5 truncate text-[11px] text-white/40">
                              {summary}
                            </p>
                          ) : null;
                        })()}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            next.delete(l.id);
                            return next;
                          })
                        }
                        aria-label={`Remove ${l.name}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-red-500/10 hover:text-red-300 active:scale-90"
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ))}
              </ul>
              {guestRange && (
                <p className="mt-2 text-xs text-white/40">
                  These items serve{" "}
                  {guestRange.max
                    ? `${guestRange.min}–${guestRange.max}`
                    : `${guestRange.min}+`}{" "}
                  guests.
                </p>
              )}
            </section>
          )}

          {/* Event date */}
          <section>
            <label
              htmlFor="event-date"
              className="mb-2 block text-sm font-medium text-white/60"
            >
              Event date *
            </label>
            <input
              id="event-date"
              type="date"
              value={eventDate}
              min={minDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="glass-input h-12 w-full px-4 text-base text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            {dateError && (
              <p className="mt-1.5 text-xs text-red-300">{dateError}</p>
            )}
            {!dateError && oneOffBlackouts.size + recurringBlackoutWeekdays.size > 0 && !eventDate && (
              <p className="mt-1.5 text-xs text-white/40">
                Earliest available: {minDate}. Some dates are blocked by the
                creator.
              </p>
            )}
          </section>

          {/* Event time */}
          <section>
            <span
              id="event-time-label"
              className="mb-2 block text-sm font-medium text-white/60"
            >
              Event time (optional)
            </span>
            <div className="flex gap-3">
              <div className="flex-1">
                <span id="event-time-start-label" className="mb-1 block text-xs text-white/50">
                  Start
                </span>
                <TimePicker12h
                  value={eventTime}
                  onChange={setEventTime}
                  ariaLabelledBy="event-time-start-label"
                />
              </div>
              <div className="flex-1">
                <span id="event-time-end-label" className="mb-1 block text-xs text-white/50">
                  End
                </span>
                <TimePicker12h
                  value={eventEndTime}
                  onChange={setEventEndTime}
                  ariaLabelledBy="event-time-end-label"
                />
              </div>
            </div>
          </section>

          {/* Guest count */}
          <section>
            <label
              htmlFor="guest-count"
              className="mb-2 block text-sm font-medium text-white/60"
            >
              Guest count *
            </label>
            <input
              id="guest-count"
              type="number"
              inputMode="numeric"
              min={1}
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value.replace(/\D/g, ""))}
              placeholder={guestRange ? `${guestRange.min}+` : "25"}
              className="glass-input h-12 w-full px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            {guestError && (
              <p className="mt-1.5 text-xs text-red-300">{guestError}</p>
            )}
          </section>

          {/* Event address */}
          <section>
            <label
              htmlFor="event-address"
              className="mb-2 block text-sm font-medium text-white/60"
            >
              Event location
            </label>
            <input
              id="event-address"
              type="text"
              value={eventAddress}
              onChange={(e) => setEventAddress(e.target.value.slice(0, 500))}
              placeholder="Street, city, state, zip"
              className="glass-input h-12 w-full px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            <p className="mt-1.5 text-xs text-white/40">
              Required for delivery / on-site jobs. Pickup orders can skip.
            </p>
          </section>

          {/* Venue type */}
          <section aria-labelledby="venue-label">
            <span id="venue-label" className="mb-2 block text-sm font-medium text-white/60">
              Venue type
            </span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="venue-label">
              {(
                [
                  { value: "residence", label: "Residence" },
                  { value: "venue", label: "Venue" },
                  { value: "other", label: "Other" },
                ] as const
              ).map((opt) => {
                const active = venueType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setVenueType(active ? "" : opt.value)}
                    className={cn(
                      "glass-card flex h-11 items-center justify-center rounded-xl border text-sm font-medium transition-all active:scale-[0.98]",
                      active
                        ? "border-green-400/40 bg-green-900/40 text-green-300"
                        : "border-white/10 text-white/60 hover:text-white/80"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Indoor/outdoor */}
          <section aria-labelledby="indoor-label">
            <span id="indoor-label" className="mb-2 block text-sm font-medium text-white/60">
              Setting
            </span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="indoor-label">
              {(
                [
                  { value: "indoor", label: "Indoor" },
                  { value: "outdoor", label: "Outdoor" },
                  { value: "mixed", label: "Mixed" },
                ] as const
              ).map((opt) => {
                const active = indoorOutdoor === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setIndoorOutdoor(active ? "" : opt.value)}
                    className={cn(
                      "glass-card flex h-11 items-center justify-center rounded-xl border text-sm font-medium transition-all active:scale-[0.98]",
                      active
                        ? "border-green-400/40 bg-green-900/40 text-green-300"
                        : "border-white/10 text-white/60 hover:text-white/80"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Server + setup checkboxes */}
          <section>
            <span className="mb-2 block text-sm font-medium text-white/60">
              Extras
            </span>
            <div className="space-y-2">
              {[
                { label: "I'd like a server to stay during the event", state: needsServer, setter: setNeedsServer },
                { label: "I need help with setup", state: needsSetup, setter: setNeedsSetup },
              ].map(({ label, state, setter }) => (
                <button
                  key={label}
                  type="button"
                  role="checkbox"
                  aria-checked={state}
                  onClick={() => setter(!state)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-all active:scale-[0.99]",
                    state
                      ? "border-green-400/40 bg-green-900/30 text-white"
                      : "border-white/10 bg-white/[0.02] text-white/70 hover:text-white"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      state ? "border-green-400 bg-green-500 text-black" : "border-white/30"
                    )}
                    aria-hidden="true"
                  >
                    {state && <Check size={14} strokeWidth={3} />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Setup time (only when needs_setup) */}
          {needsSetup && (
            <section aria-labelledby="setup-time-label">
              <span
                id="setup-time-label"
                className="mb-2 block text-sm font-medium text-white/60"
              >
                Earliest setup time
              </span>
              <TimePicker12h
                value={earliestSetup}
                onChange={setEarliestSetup}
                ariaLabelledBy="setup-time-label"
              />
            </section>
          )}

          {/* Kitchen */}
          <section aria-labelledby="kitchen-label">
            <span id="kitchen-label" className="mb-2 block text-sm font-medium text-white/60">
              Kitchen available at venue?
            </span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="kitchen-label">
              {(["yes", "no"] as const).map((opt) => {
                const active = kitchenAvailable === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setKitchenAvailable(active ? "" : opt)}
                    className={cn(
                      "glass-card flex h-11 items-center justify-center rounded-xl border text-sm font-medium capitalize transition-all active:scale-[0.98]",
                      active
                        ? "border-green-400/40 bg-green-900/40 text-green-300"
                        : "border-white/10 text-white/60 hover:text-white/80"
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Allergies */}
          <section>
            <label
              htmlFor="allergies"
              className="mb-2 block text-sm font-medium text-white/60"
            >
              Allergies or dietary restrictions
            </label>
            <textarea
              id="allergies"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value.slice(0, 1000))}
              placeholder="Nut allergy, vegan guest, etc."
              rows={2}
              className="glass-input w-full px-4 py-3 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 resize-none"
            />
          </section>

          {/* Notes */}
          <section>
            <label
              htmlFor="notes"
              className="mb-2 block text-sm font-medium text-white/60"
            >
              Anything else?
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              placeholder="Theme, special requests, menu ideas, budget range..."
              rows={4}
              className="glass-input w-full px-4 py-3 text-base text-white placeholder:text-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 resize-none"
            />
          </section>
        </div>
      </div>

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0A]/80 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white transition-all active:scale-95",
              canSubmit
                ? "bg-[#1B5E20] shadow-[0_0_20px_rgba(27,94,32,0.5)]"
                : "cursor-not-allowed bg-white/[0.08] text-white/40"
            )}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Send size={16} />
                Send inquiry
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[11px] text-white/40">
            {creatorName} will reply with a quote. No deposit charged yet.
          </p>
        </div>
      </div>
    </div>
  );
}
