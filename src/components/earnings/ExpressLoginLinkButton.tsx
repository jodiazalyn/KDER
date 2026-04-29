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
      className="flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 text-left active:bg-white/[0.06] transition-colors disabled:opacity-60"
    >
      <div className="flex items-center gap-3">
        <ExternalLink size={18} className="text-white/60" />
        <div>
          <p className="text-sm font-medium text-white">Manage in Stripe</p>
          <p className="text-xs text-white/50">
            Bank info, tax docs, account details
          </p>
        </div>
      </div>
      {loading ? (
        <Loader2 size={16} className="animate-spin text-white/40" />
      ) : null}
    </button>
  );
}
