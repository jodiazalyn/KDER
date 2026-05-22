import { Check, MapPin } from "lucide-react";
import { PhoneStatusBar } from "./PhoneStatusBar";

/**
 * Order-confirmation preview screen — what a customer sees right
 * after placing an order with @auntlulu. The "accepted" status pill
 * communicates the M2M trust loop (creator chose to take this
 * order, customer knows their plate is being made).
 *
 * Same dark-theme tokens as the actual app's order-confirmation
 * route. Sits as the secondary phone in the Hero (rotated, behind
 * the Storefront screen) so it provides depth without competing
 * for attention.
 */

export function OrderPhoneScreen() {
  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      <PhoneStatusBar />

      {/* Top header */}
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <span className="text-[10px] font-medium text-white/50">Order</span>
        <span className="font-mono text-[9px] text-white/40">#KD-7842</span>
      </div>

      {/* Status hero */}
      <div className="mx-4 mb-4 flex flex-col items-center gap-2 rounded-2xl border border-kder-green/30 bg-kder-green/10 px-4 py-5 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kder-green text-white">
          <Check size={18} strokeWidth={2.5} />
        </div>
        <p className="text-sm font-bold text-white">Order accepted</p>
        <p className="text-[10px] text-white/60">
          Aunt Lulu started your plate.
        </p>
      </div>

      {/* Order item */}
      <div className="mx-4 mb-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 shrink-0 rounded-lg bg-gradient-to-br from-amber-700 via-orange-800 to-red-900"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold text-white">
              Smothered Pork Chop
            </p>
            <p className="text-[10px] text-white/50">Qty 1</p>
          </div>
          <p className="text-[11px] font-bold text-white">$18.00</p>
        </div>
      </div>

      {/* Pickup details */}
      <div className="mx-4 mb-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-white/40">
          Pickup
        </p>
        <div className="flex items-start gap-2">
          <MapPin size={12} className="mt-0.5 shrink-0 text-kder-green-light" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-white">
              2814 Dowling St
            </p>
            <p className="text-[10px] text-white/60">
              Third Ward · Ready by 6:45 PM
            </p>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="mx-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
        <div className="flex items-center justify-between text-[10px] text-white/60">
          <span>Subtotal</span>
          <span>$18.00</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-white/60">
          <span>Service</span>
          <span>$1.50</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[11px] font-bold text-white">
          <span>Total</span>
          <span>$19.50</span>
        </div>
      </div>
    </div>
  );
}
