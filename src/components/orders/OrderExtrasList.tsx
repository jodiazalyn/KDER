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
      key: `${it.listing_id}-${e.group ?? ""}-${e.name}`,
      name: e.name,
      qty: e.qty,
      price_cents: e.price_cents,
      // Required-choice picks (migration 023) carry their group label
      // (e.g. "Protein") and read as "Protein: 2 Beef Patties" rather
      // than the "+ {qty} {name}" add-on format.
      group: e.group,
    }))
  );
  if (rows.length === 0) return null;

  const tight = density === "tight";

  return (
    <ul
      className={
        tight ? "mt-1 space-y-0.5" : "mt-1.5 space-y-1 border-l-2 border-border pl-2"
      }
    >
      {rows.map((r) => (
        <li
          key={r.key}
          className={
            tight
              ? "truncate text-[11px] text-muted-foreground"
              : "flex items-baseline justify-between text-xs text-muted-foreground"
          }
        >
          <span className={tight ? "" : "min-w-0 truncate"}>
            {r.group ? (
              // Required choice — "Protein: 2 Beef Patties". No "+qty"
              // prefix: it's a single required pick, not a stacked add-on.
              <>
                <span className="font-medium text-foreground/80">
                  {r.group}:
                </span>{" "}
                {r.name}
              </>
            ) : (
              <>
                + {r.qty} {r.name}
              </>
            )}
          </span>
          {!tight && showPrices && r.price_cents > 0 && (
            <span className="shrink-0 tabular-nums text-muted-foreground/80">
              ${((r.price_cents / 100) * r.qty).toFixed(2)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
