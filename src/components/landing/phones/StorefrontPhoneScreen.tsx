import { Star } from "lucide-react";
import { PhoneStatusBar } from "./PhoneStatusBar";

/**
 * Storefront preview screen — the marketing view of what a
 * customer sees when they tap @auntlulu's link. Rendered entirely
 * in CSS (no PNG screenshot dependency) so it's pixel-perfect at
 * any size and never goes stale relative to the real product.
 *
 * Same dark-theme tokens as the actual in-app storefront
 * (#0A0A0A bg, white headlines, KDER green accents) so a viewer
 * who later signs up sees exactly this aesthetic. The featured
 * creator + plates are intentionally curated marketing fiction —
 * if/when we have a real flagship creator we'd point this at
 * their data, or generalize to a `<StorefrontPhoneScreen
 * creator={...} plates={...} />` API.
 */

interface PlateCard {
  name: string;
  price: number;
  /** Tailwind gradient classes for the food image placeholder. */
  gradient: string;
}

const PLATES: PlateCard[] = [
  {
    name: "Smothered Pork Chop",
    price: 18,
    gradient: "from-amber-700 via-orange-800 to-red-900",
  },
  {
    name: "Oxtail Sunday Plate",
    price: 22,
    gradient: "from-yellow-700 via-amber-800 to-orange-900",
  },
  {
    name: "Catfish & Grits",
    price: 16,
    gradient: "from-yellow-600 via-amber-700 to-stone-800",
  },
  {
    name: "Greens & Cornbread",
    price: 12,
    gradient: "from-emerald-800 via-emerald-900 to-stone-900",
  },
];

export function StorefrontPhoneScreen() {
  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      <PhoneStatusBar />

      {/* Top bar — tiny breadcrumb + share icon spacer */}
      <div className="flex items-center justify-between px-4 pb-2 pt-3 text-[10px] font-medium text-white/50">
        <span>kder.club/@auntlulu</span>
        <span aria-hidden="true">⋯</span>
      </div>

      {/* Creator header */}
      <div className="flex items-start gap-3 px-4 pb-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 to-red-800 text-base font-bold">
          AL
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold leading-tight text-white">
            Aunt Lulu&rsquo;s Kitchen
          </h3>
          <p className="text-[10px] text-white/50">@auntlulu</p>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/70">
            <Star size={9} className="fill-kder-green text-kder-green" />
            <span className="font-semibold text-white">4.9</span>
            <span className="text-white/30">·</span>
            <span>Third Ward</span>
            <span className="text-white/30">·</span>
            <span>Soul Food</span>
          </div>
        </div>
      </div>

      {/* Bio */}
      <p className="px-4 pb-4 text-[11px] leading-relaxed text-white/70">
        Sunday plates, Wednesday specials. Cooked from my grandmother&rsquo;s
        recipes, picked up at my front porch.
      </p>

      {/* Stats strip */}
      <div className="mx-4 mb-4 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] py-2 text-center">
        <div>
          <p className="text-sm font-bold text-white">142</p>
          <p className="text-[9px] uppercase tracking-wider text-white/40">
            Orders
          </p>
        </div>
        <div className="border-x border-white/[0.06]">
          <p className="text-sm font-bold text-white">4</p>
          <p className="text-[9px] uppercase tracking-wider text-white/40">
            Plates
          </p>
        </div>
        <div>
          <p className="text-sm font-bold text-kder-green-light">98%</p>
          <p className="text-[9px] uppercase tracking-wider text-white/40">
            On time
          </p>
        </div>
      </div>

      {/* Plate grid */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        {PLATES.map((plate) => (
          <div
            key={plate.name}
            className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
          >
            <div
              className={`aspect-square w-full bg-gradient-to-br ${plate.gradient}`}
              aria-hidden="true"
            />
            <div className="px-2 pb-2 pt-1.5">
              <p className="truncate text-[10px] font-semibold text-white">
                {plate.name}
              </p>
              <p className="text-[10px] font-bold text-kder-green-light">
                ${plate.price}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
