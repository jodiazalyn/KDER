"use client";

import { useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Customer-side order close-out: after the creator marks the order
 * complete, the customer confirms they received it (or reports a
 * problem), then optionally leaves a star review.
 *
 * Flow:
 *   1. "Did you receive your order?"  → Yes  | Report a problem
 *   2a. Yes → PUT /received {received} → review step
 *   2b. Problem → note textarea → PUT /received {problem, note} → review step
 *   3. Review: stars required (1-5), text optional, Skip allowed →
 *      POST /review on submit (skip = no call).
 *
 * Renders nothing once the order has been confirmed (receipt_status
 * set) and the review step is done/skipped.
 */
export function OrderReceiptReview({
  orderId,
  status,
  receiptStatus,
  onConfirmed,
}: {
  orderId: string;
  status: string;
  receiptStatus: string | null;
  onConfirmed?: () => void;
}) {
  // Local phase machine. Seed from the server: if receipt already
  // confirmed, jump straight to the review step (customer can still
  // leave/skip a review on a return visit).
  const [phase, setPhase] = useState<
    "ask" | "problem" | "review" | "done"
  >(receiptStatus ? "review" : "ask");
  const [note, setNote] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [reviewBody, setReviewBody] = useState("");
  const [busy, setBusy] = useState(false);

  // Only relevant once the creator has fulfilled the order.
  if (status !== "completed" && status !== "ready") return null;
  if (phase === "done") return null;

  async function confirmReceipt(kind: "received" | "problem") {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/received`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: kind,
          note: kind === "problem" ? note.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Couldn't save your confirmation.");
      }
      onConfirmed?.();
      if (kind === "problem") {
        toast.success("Thanks — our team has been notified.");
      }
      setPhase("review");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    if (rating < 1) {
      toast.error("Please tap a star rating first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          body: reviewBody.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Couldn't save your review.");
      }
      toast.success("Thanks for the review!");
      setPhase("done");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  // ── Step 1: ask ────────────────────────────────────────────────
  if (phase === "ask") {
    return (
      <div className="glass-card border-green-400/[0.25] bg-green-900/[0.12] p-4">
        <p className="text-sm font-bold text-white">
          Did you receive your order?
        </p>
        <p className="mt-0.5 text-xs text-white/50">
          Confirm so we can close it out — or let us know if something
          went wrong.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => confirmReceipt("received")}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-green-600 text-sm font-bold text-white active:scale-95 transition-transform disabled:opacity-60"
          >
            <CheckCircle2 size={16} /> Yes, got it
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setPhase("problem")}
            className="glass-btn-pill flex h-11 flex-1 items-center justify-center text-sm font-semibold text-white/80 active:scale-95 transition-transform disabled:opacity-60"
          >
            Report a problem
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2b: problem note ──────────────────────────────────────
  if (phase === "problem") {
    return (
      <div className="glass-card border-red-400/[0.25] bg-red-900/[0.12] p-4">
        <p className="text-sm font-bold text-white">What went wrong?</p>
        <p className="mt-0.5 text-xs text-white/50">
          Tell us what happened — our team will follow up.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Describe the issue (e.g. order never arrived, wrong item)…"
          className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy || !note.trim()}
            onClick={() => confirmReceipt("problem")}
            className="flex h-11 flex-1 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white active:scale-95 transition-transform disabled:opacity-50"
          >
            Submit report
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setPhase("ask")}
            className="glass-btn-pill flex h-11 items-center justify-center px-5 text-sm font-semibold text-white/70 active:scale-95 transition-transform disabled:opacity-60"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: review ─────────────────────────────────────────────
  return (
    <div className="glass-card p-4">
      <p className="text-sm font-bold text-white">Leave a review</p>
      <p className="mt-0.5 text-xs text-white/50">
        How was it? Stars required, a note is optional.
      </p>
      <div className="mt-3 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= (hover || rating);
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="p-0.5 active:scale-90 transition-transform"
            >
              <Star
                size={30}
                className={cn(
                  active ? "text-yellow-400" : "text-white/20"
                )}
                fill={active ? "currentColor" : "none"}
              />
            </button>
          );
        })}
      </div>
      <textarea
        value={reviewBody}
        onChange={(e) => setReviewBody(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Share a few words (optional)…"
        className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy || rating < 1}
          onClick={submitReview}
          className="flex h-11 flex-1 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white active:scale-95 transition-transform disabled:opacity-50"
        >
          Submit review
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setPhase("done")}
          className="glass-btn-pill flex h-11 items-center justify-center px-5 text-sm font-semibold text-white/70 active:scale-95 transition-transform disabled:opacity-60"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
