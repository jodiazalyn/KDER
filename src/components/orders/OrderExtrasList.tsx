import type { OrderItemSnapshot } from "@/types";

/**
 * Compact "+ {qty} {name}" sub-list of the customer's chosen extras
 * (migration 018). Reused across the creator's order list / detail
 * page and the customer's confirmation page so the rendering is
 * consistent.
 *
 * Hidden when there are no extras — returns null so the caller
 * doesn't need to gate on `.length` itself.
 *
 * `density` controls spacing and font size — "tight" for inbox
 * rows where space is precious, "comfortable" for detail pages.
 */
export function OrderExtrasList({
  items,
  density = "comfortable",
  showPrices = true,
}: {
  items: OrderItemSnapshot[] | undefined;
  density?: "tight" | "comfortable";
  showPrices?: boolean;
}) {
  if (!items || items.length === 0) return null;
  // Flatten every line item's extras into one list. (We don't show
  // which plate each extra was attached to in the inbox row — the
  // creator already knows the plate from the listing_name line
  // above this component.)
  const rows = items.flatMap((it) =>
    (it.extras ?? []).map((e) => ({
      key: `${it.listing_id}-${e.name}`,
      name: e.name,
      qty: e.qty,
      price_cents: e.price_cents,
    }))
  );
  if (rows.length === 0) return null;

  const tight = density === "tight";

  return (
    <ul
      className={
        tight ? "mt-1 space-y-0.5" : "mt-1.5 space-y-1 border-l-2 border-white/[0.08] pl-2"
      }
    >
      {rows.map((r) => (
        <li
          key={r.key}
          className={
            tight
              ? "truncate text-[11px] text-white/45"
              : "flex items-baseline justify-between text-xs text-white/65"
          }
        >
          <span className={tight ? "" : "min-w-0 truncate"}>
            + {r.qty} {r.name}
          </span>
          {!tight && showPrices && r.price_cents > 0 && (
            <span className="shrink-0 tabular-nums text-white/55">
              ${((r.price_cents / 100) * r.qty).toFixed(2)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
