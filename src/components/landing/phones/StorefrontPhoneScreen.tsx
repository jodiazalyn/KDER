import Image from "next/image";
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
  /** Unsplash photo URL. ?w=300 is plenty — the tile renders ~80px wide
      in the hero mockup, and Next/Image will further optimize on the
      edge based on the device. */
  photo: string;
  alt: string;
}

const PHOTO = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=300&q=80&auto=format&fit=crop`;

// Photo IDs are stable Unsplash assets. If a creator-facing flagship
// is set up later, swap these for real plate photos from their account.
const PLATES: PlateCard[] = [
  {
    name: "Smothered Pork Chop",
    price: 18,
    photo: PHOTO("1544025162-d76694265947"),
    alt: "Plated smothered meat dish",
  },
  {
    name: "Oxtail Sunday Plate",
    price: 22,
    // Rich, glossy braised-meat ragu over wide pasta — reads as the
    // kind of slow-cooked Sunday plate the title suggests.
    photo: PHOTO("1611270629569-8b357cb88da9"),
    alt: "Braised oxtail ragu over pappardelle",
  },
  {
    name: "Catfish & Grits",
    price: 16,
    // Fine-dining seared fish over greens. Stand-in until a real
    // catfish-and-grits hero shot replaces it.
    photo: PHOTO("1467003909585-2f8a72700288"),
    alt: "Pan-seared fish plated over wilted greens",
  },
  {
    name: "Greens & Cornbread",
    price: 12,
    photo: PHOTO("1546069901-ba9599a7e63c"),
    alt: "Greens and grain bowl",
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
            <div className="relative aspect-square w-full">
              <Image
                src={plate.photo}
                alt={plate.alt}
                fill
                sizes="(max-width: 1024px) 100px, 130px"
                className="object-cover"
              />
            </div>
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
