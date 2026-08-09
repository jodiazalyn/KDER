import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Landing-page section that promotes the free /pricing-agent chat.
 *
 * Sits between the hero and the existing HowItWorks sections so the
 * agent shows up before we ask anyone to commit. Anchor copy intent:
 * meet visitors at "I have groceries, what now?" — that's exactly the
 * conversion-killing question a creator account doesn't directly
 * answer.
 *
 * The KDER mark anchors the visual identity so the chat coach
 * obviously belongs to KDER (not a generic AI).
 */
export function PricingAgentCTA() {
  return (
    <section
      className="bg-white px-4 py-16 sm:py-24"
      aria-labelledby="pricing-agent-cta-heading"
    >
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
          Meet Mia · your KDER helper
        </p>

        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {/* Brand mark — anchors the "this is KDER's concierge, not
              random AI" read. 64px on mobile, 80px on sm+ so it
              doesn't feel token. */}
          <div className="shrink-0">
            <Image
              src="/brand/mark-green.png"
              alt="KDER"
              width={80}
              height={80}
              className="h-16 w-16 sm:h-20 sm:w-20"
              priority={false}
            />
          </div>

          <div className="min-w-0 flex-1">
            <h2
              id="pricing-agent-cta-heading"
              className="text-3xl font-black leading-tight text-black sm:text-4xl"
            >
              Thinking about
              <br />
              selling your food?
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-neutral-700">
              Mia helps home cooks start on KDER. She helps you pick
              what to make, set a fair price, and write a post that gets
              your first orders. Free to try. No sign-up needed.
            </p>

            <Link
              href="/pricing-agent"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1B5E20] px-6 py-3 text-sm font-bold text-white shadow-[0_6px_24px_rgba(27,94,32,0.35)] transition-all hover:shadow-[0_8px_32px_rgba(27,94,32,0.45)] active:scale-95"
            >
              Chat with Mia
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
