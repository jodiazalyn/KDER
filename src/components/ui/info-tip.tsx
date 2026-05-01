"use client";

import * as Popover from "@radix-ui/react-popover";
import { HelpCircle } from "lucide-react";

interface InfoTipProps {
  /** The popover content — usually a short paragraph or two of explanatory text. */
  children: React.ReactNode;
  /** Accessible label for the trigger button. Defaults to "More info". */
  label?: string;
  /** Which side of the trigger to position the popover. Default `top`. */
  side?: "top" | "right" | "bottom" | "left";
  /** Optional className override for the trigger icon size / color. */
  triggerClassName?: string;
}

/**
 * Inline (?) icon that opens an explanatory popover on tap. Replaces
 * the old `title=""` HTML attribute (which only fires on hover and
 * therefore does nothing on touch devices) with a mobile-friendly
 * tap-to-reveal pattern.
 *
 * Built on `@radix-ui/react-popover` so we get accessibility for free
 * (focus management, escape-to-close, click-outside-to-close, proper
 * ARIA attributes). Aligns with the existing shadcn-style stack
 * already using `@radix-ui/react-dialog`, `react-label`, `react-slot`.
 *
 * Pair `<InfoTip>` with `<Coachmark>`: a Coachmark fires once on first
 * visit pointing the user at a key field; the InfoTip stays around
 * forever as a re-readable hint. Both can carry the same copy.
 */
export function InfoTip({
  children,
  label = "More info",
  side = "top",
  triggerClassName,
}: InfoTipProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className={
            triggerClassName ??
            "ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-white/40 hover:text-white/70 active:scale-90 transition-all"
          }
        >
          <HelpCircle size={14} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          sideOffset={6}
          collisionPadding={16}
          className="z-[80] max-w-[280px] rounded-xl border border-white/[0.12] bg-[#0A0A0A]/95 p-3 text-xs leading-relaxed text-white/85 shadow-xl backdrop-blur-md focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {children}
          <Popover.Arrow className="fill-[#0A0A0A]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
