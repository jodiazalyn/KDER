"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

/**
 * Pricing Coach — global mount + open/close API.
 *
 * The pricing-coach agent used to live exclusively at /pricing-agent
 * (its own route). That meant:
 *   - creators had to leave whatever they were doing to ask a question
 *   - inline "need pricing help?" affordances elsewhere in the app had
 *     to deep-link out
 *   - state (current conversation, scroll position) didn't survive
 *     across route transitions
 *
 * This provider mounts the agent once at the app-shell level inside a
 * bottom Sheet that can be summoned from anywhere via `usePricingCoach`.
 * Because the agent component stays mounted (we just show/hide the
 * sheet), in-flight conversations persist across opens — the user can
 * close the sheet, navigate, reopen, and pick up exactly where they
 * left off.
 *
 * The /pricing-agent route still exists for direct-link / SEO surfaces
 * (the landing page CTA, deep links from emails). It uses the same
 * client component without the embedded flag.
 *
 * Profile + chat-history sync:
 *   - We resolve `isAuthed` once on mount via the browser supabase
 *     client. Authed users get their /chats list available via the
 *     existing "Past chats" drawer inside the agent UI.
 *   - Anon users still get localStorage persistence (handled inside
 *     PricingAgentClient).
 */

// Loaded only when the sheet first opens — keeps the streaming chat
// chunk + its renderer out of the initial app-shell bundle.
const PricingAgentClient = dynamic(
  () =>
    import("@/app/pricing-agent/pricing-agent-client").then(
      (m) => m.PricingAgentClient
    ),
  { ssr: false }
);

interface PricingCoachContextValue {
  /** Open the coach sheet. Optionally seed the input with a prompt
   *  (e.g. "Help me price brisket plates"). The seed is consumed once
   *  on next open; it doesn't persist after the user edits / sends. */
  open: (seedPrompt?: string) => void;
  close: () => void;
  isOpen: boolean;
  /** Routes where the floating launcher should NOT render (already on
   *  the agent surface). Hosts use this so we don't double up. */
  isOnAgentPage: boolean;
}

const PricingCoachContext = createContext<PricingCoachContextValue | null>(
  null
);

export function usePricingCoach(): PricingCoachContextValue {
  const ctx = useContext(PricingCoachContext);
  if (!ctx) {
    throw new Error(
      "usePricingCoach must be used inside <PricingCoachProvider>"
    );
  }
  return ctx;
}

export function PricingCoachProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isOnAgentPage = pathname?.startsWith("/pricing-agent") ?? false;

  const [isOpen, setIsOpen] = useState(false);
  const [seedPrompt, setSeedPrompt] = useState<string | undefined>(undefined);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);

  // Resolve auth state once on mount. We don't need a subscription —
  // the user signing in mid-session is rare here, and the embedded
  // client already handles the anon→authed import via its own effect.
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) setIsAuthed(!!user);
      } catch {
        // Supabase not configured (demo mode) — treat as anon.
        if (!cancelled) setIsAuthed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const open = useCallback((nextSeed?: string) => {
    if (nextSeed) setSeedPrompt(nextSeed);
    setIsOpen(true);
    setHasOpenedOnce(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Clear the seed after the sheet has actually opened so a second
  // open without a prompt doesn't re-pre-fill the input.
  useEffect(() => {
    if (!isOpen && seedPrompt) {
      // Defer until after close completes so the embedded client
      // doesn't see the seed flicker away during the unmount race.
      const id = setTimeout(() => setSeedPrompt(undefined), 350);
      return () => clearTimeout(id);
    }
  }, [isOpen, seedPrompt]);

  const value = useMemo<PricingCoachContextValue>(
    () => ({ open, close, isOpen, isOnAgentPage }),
    [open, close, isOpen, isOnAgentPage]
  );

  return (
    <PricingCoachContext.Provider value={value}>
      {children}
      {/* Sheet host — mounted at the provider root so it portals to body
          and survives child route transitions. The agent component
          itself only loads on first open. */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="bottom"
          // Override default sheet padding + max-height so Mia fills
          // the sheet edge-to-edge (she has her own header + input
          // styled to sheet conventions).
          // The arbitrary selector `[&>button.absolute]:hidden` hides
          // the built-in SheetContent close — Mia renders her own X
          // inline in the header, which has higher contrast on the
          // dark surface than the default white/10 close chip. (Both
          // close the sheet, so we want exactly one.)
          className="h-[100dvh] max-h-[100dvh] gap-0 border-none bg-[#0A0A0A] p-0 [&>button.absolute]:hidden"
        >
          {/* Radix requires a Title for a11y; we hide it visually
              because the embedded client renders its own header.
              Tailwind's `sr-only` keeps the nodes in the a11y tree
              while removing them from the visual layout — same
              outcome as @radix-ui/react-visually-hidden but no extra
              dependency. */}
          <SheetTitle className="sr-only">Mia — KDER concierge</SheetTitle>
          <SheetDescription className="sr-only">
            Mia helps you set up your KDER account, sharpen plate
            listings, work out pricing, and grow your business.
          </SheetDescription>
          {hasOpenedOnce && isAuthed !== null && (
            <PricingAgentClient
              isAuthed={isAuthed}
              embedded
              seedInput={seedPrompt}
              onClose={close}
            />
          )}
        </SheetContent>
      </Sheet>
    </PricingCoachContext.Provider>
  );
}
