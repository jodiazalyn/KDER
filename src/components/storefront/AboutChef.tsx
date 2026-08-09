"use client";

import Image from "next/image";
import { Globe, MessageCircle, ShieldCheck, Star } from "lucide-react";
import type { CreatorProfile } from "@/lib/creator-store";

interface AboutChefProps {
  creator: CreatorProfile;
  onMessageClick: () => void;
}

/**
 * Airbnb-Experiences-style "meet your host" card.
 *
 * A centered chef card — avatar, name, "Chef" role — with a full-width
 * "Message" button, a payment-protection reassurance line, a compact
 * stats strip (Vibe Score / Orders / Plates), and the creator's social
 * links. This lives near the bottom of the single-scroll storefront,
 * mirroring where Airbnb surfaces the host profile.
 */
export function AboutChef({ creator, onMessageClick }: AboutChefProps) {
  const hasSocials =
    creator.instagram_handle ||
    creator.tiktok_handle ||
    creator.website_url ||
    creator.facebook_handle ||
    creator.whatsapp_number;

  return (
    <section className="px-4 py-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        {/* Chef identity */}
        <div className="flex flex-col items-center text-center">
          <div className="rounded-full bg-gradient-to-br from-[#37C871] to-[#1B5E20] p-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
            {creator.photo_url ? (
              <Image
                src={creator.photo_url}
                alt={creator.display_name}
                width={96}
                height={96}
                className="h-24 w-24 rounded-full border-[3px] border-card object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-card bg-primary/15 text-4xl font-bold text-primary">
                {creator.display_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.02em] text-foreground">
            {creator.display_name}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Chef</p>
        </div>

        {/* Message CTA */}
        <button
          type="button"
          onClick={onMessageClick}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-foreground/[0.04] text-sm font-bold text-foreground transition-colors hover:bg-foreground/[0.08] active:scale-[0.98]"
        >
          <MessageCircle size={16} />
          Message {creator.display_name}
        </button>

        {/* Payment-protection reassurance */}
        <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck size={14} className="mt-px shrink-0 text-primary" />
          <span>
            To help protect your payment, always use KDER to order and message
            your chef.
          </span>
        </p>

        {/* Stats strip */}
        <div className="mt-5 flex gap-2.5">
          <StatTile
            value={
              <span className="inline-flex items-center gap-1">
                <Star size={13} className="fill-primary text-primary" />
                {creator.vibe_score != null
                  ? Math.round(creator.vibe_score)
                  : "—"}
              </span>
            }
            label="Vibe Score"
          />
          <StatTile value={formatCount(creator.total_orders)} label="Orders" />
          <StatTile
            value={<span className="text-primary">{creator.total_plates}</span>}
            label="Plates"
          />
        </div>

        {/* Social links */}
        {hasSocials && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {creator.instagram_handle && (
              <LinkPill
                href={`https://instagram.com/${creator.instagram_handle}`}
                icon={<InstagramIcon className="h-[15px] w-[15px]" />}
                label="Instagram"
              />
            )}
            {creator.tiktok_handle && (
              <LinkPill
                href={`https://tiktok.com/@${creator.tiktok_handle}`}
                icon={<TikTokIcon className="h-[15px] w-[15px]" />}
                label="TikTok"
              />
            )}
            {creator.website_url && (
              <LinkPill
                href={creator.website_url}
                icon={<Globe size={15} className="text-primary" />}
                label="Website"
              />
            )}
            {creator.facebook_handle && (
              <LinkPill
                href={`https://facebook.com/${creator.facebook_handle}`}
                icon={<FacebookIcon className="h-[15px] w-[15px]" />}
                label="Facebook"
              />
            )}
            {creator.whatsapp_number && (
              <LinkPill
                href={`https://wa.me/${creator.whatsapp_number.replace(/\D/g, "")}`}
                icon={<WhatsAppIcon className="h-[15px] w-[15px]" />}
                label="WhatsApp"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function StatTile({
  value,
  label,
}: {
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex-1 rounded-2xl border border-border bg-foreground/[0.04] px-2.5 py-3 text-center">
      <div className="text-lg font-extrabold leading-none tracking-[-0.02em] text-foreground">
        {value}
      </div>
      <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function LinkPill({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-[34px] items-center gap-2 rounded-full border border-border bg-foreground/[0.06] px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.1]"
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

/** Compact count formatting — 1400 → "1.4k", 950 → "950". */
function formatCount(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return n.toString();
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.76a8.27 8.27 0 004.84 1.55V6.86a4.85 4.85 0 01-1.07-.17z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
