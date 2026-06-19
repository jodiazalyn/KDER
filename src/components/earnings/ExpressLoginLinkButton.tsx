"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * "Manage in Stripe" button. Mints a single-use Express dashboard URL
 * on click and opens it in a new tab. Creators use this for bank/card
 * management, tax docs (1099-K), and any Stripe-side setting we don't
 * surface in KDER's UI.
 */
export function ExpressLoginLinkButton() {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/creators/connect/login-link", {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.data?.url) {
        const code = json?.code ? ` [${json.code}]` : "";
        toast.error(`${json?.error ?? "Couldn't open Stripe"}${code}`);
        setLoading(false);
        return;
      }
      // Single-use URL with ~5 min expiry. Open in new tab.
      window.open(json.data.url, "_blank", "noopener");
    } catch (err) {
      console.error("[ExpressLoginLinkButton] network error:", err);
      toast.error("Couldn't reach Stripe. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="glass-card rounded-glass-lg flex w-full items-center justify-between p-4 text-left active:bg-muted/60 transition-colors disabled:opacity-60"
    >
      <div className="flex items-center gap-3">
        <ExternalLink size={18} className="text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">Manage in Stripe</p>
          <p className="text-xs text-muted-foreground">
            Bank info, tax docs, account details
          </p>
        </div>
      </div>
      {loading ? (
        <Loader2 size={16} className="animate-spin text-muted-foreground/60" />
      ) : null}
    </button>
  );
}
