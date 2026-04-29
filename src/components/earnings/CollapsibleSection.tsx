"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";

const STORAGE_PREFIX = "kder_earn_section_";
const RESTORE_EVENT = "kder:earn:restore-sections";

interface CollapsibleSectionProps {
  /** Stable identifier for persistence (collapsed + dismissed state). */
  id: string;
  /** Section heading. */
  title: string;
  /** Optional count badge in the header (e.g. "(3)"). */
  count?: number;
  /** Initial open state when no localStorage entry exists. */
  defaultOpen?: boolean;
  /** Whether to render the X button. */
  dismissible?: boolean;
  /** Fires when the user dismisses — parent can bump a counter so the
   *  "Show hidden sections" footer link knows how many to surface. */
  onDismiss?: () => void;
  children: React.ReactNode;
}

/**
 * Collapsible + (optionally) dismissible section wrapper.
 *
 * Tap the header to collapse / expand. Tap the X to hide the section
 * entirely; persists in localStorage and only comes back when the user
 * taps the "Show hidden sections" footer link in EarningsView.
 *
 * Why both: collapse is for moment-to-moment focus; dismiss is for
 * sections a creator never cares about. Persisting both keeps the
 * page from re-cluttering on every reload.
 *
 * Cluttered information density is a trust killer on a money page.
 */
export function CollapsibleSection({
  id,
  title,
  count,
  defaultOpen = true,
  dismissible = false,
  onDismiss,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState<boolean>(() => readOpen(id, defaultOpen));
  const [dismissed, setDismissed] = useState<boolean>(() =>
    readDismissed(id)
  );

  // Re-show when the parent fires the global restore event.
  useEffect(() => {
    const handler = () => setDismissed(false);
    window.addEventListener(RESTORE_EVENT, handler);
    return () => window.removeEventListener(RESTORE_EVENT, handler);
  }, []);

  // Persist open/closed when it changes.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_PREFIX + id + "_open",
        open ? "1" : "0"
      );
    } catch {
      // localStorage unavailable; non-fatal
    }
  }, [open, id]);

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(
        STORAGE_PREFIX + id + "_dismissed",
        "1"
      );
    } catch {
      // non-fatal
    }
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <section>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={`section-${id}-body`}
          className="flex flex-1 items-center justify-between rounded-lg py-1 text-left active:opacity-70 transition-opacity"
        >
          <h2 className="flex items-center gap-2 text-lg font-bold text-white/80">
            <span>{title}</span>
            {count !== undefined && (
              <span className="text-xs font-medium text-white/40">
                {count}
              </span>
            )}
          </h2>
          <ChevronDown
            size={16}
            className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={`Hide ${title} section`}
            className="-mr-1 rounded-full p-2 text-white/30 hover:bg-white/[0.06] hover:text-white/70 active:scale-95 transition-all"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && (
        <div id={`section-${id}-body`} className="mt-3">
          {children}
        </div>
      )}
    </section>
  );
}

// ── Restore mechanism ─────────────────────────────────────────

/**
 * Render the "Show N hidden sections" footer link in EarningsView.
 * Parent owns the count; we just expose the restore action.
 */
export function restoreAllSections(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX) && k.endsWith("_dismissed")) {
        keys.push(k);
      }
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // non-fatal
  }
  window.dispatchEvent(new Event(RESTORE_EVENT));
}

/**
 * Read how many sections are currently dismissed (sync, from
 * localStorage). Use as the initial value for a counter in
 * EarningsView; bump it via onDismiss callbacks.
 */
export function countDismissedSections(): number {
  if (typeof window === "undefined") return 0;
  try {
    let n = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (
        k &&
        k.startsWith(STORAGE_PREFIX) &&
        k.endsWith("_dismissed") &&
        window.localStorage.getItem(k) === "1"
      ) {
        n += 1;
      }
    }
    return n;
  } catch {
    return 0;
  }
}

// ── Internals ─────────────────────────────────────────────────

function readOpen(id: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(STORAGE_PREFIX + id + "_open");
    if (v === null) return fallback;
    return v === "1";
  } catch {
    return fallback;
  }
}

function readDismissed(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(STORAGE_PREFIX + id + "_dismissed") === "1"
    );
  } catch {
    return false;
  }
}
