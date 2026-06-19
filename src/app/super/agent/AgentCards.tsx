"use client";

import Image from "next/image";
import {
  Store,
  UtensilsCrossed,
  Star,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import type { PlateCard, CreatorCard } from "@/lib/admin/agent-tools";

/* ────────────────────────────────────────────────────────────────
 * Result cards for the Super Dashboard analyst.
 *
 * Render the REAL rows the agent's tools returned (never model output),
 * styled to sit on Claude's warm cream canvas.
 * ──────────────────────────────────────────────────────────────── */

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Avatar({
  src,
  alt,
  size = 36,
}: {
  src: string | null;
  alt: string;
  size?: number;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="flex-shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-[#EAE8DF] text-xs font-bold text-[#9B968A]"
      style={{ width: size, height: size }}
    >
      {alt.slice(0, 1).toUpperCase() || "?"}
    </div>
  );
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber";
}) {
  const cls =
    tone === "green"
      ? "bg-[#E4EFE0] text-[#3E6B34]"
      : tone === "amber"
        ? "bg-[#F6ECD7] text-[#8A6A1F]"
        : "bg-[#EFEDE4] text-[#6B6862]";
  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

export function PlateResultCard({ plate }: { plate: PlateCard }) {
  const creatorLabel = plate.creator.handle
    ? `@${plate.creator.handle}`
    : plate.creator.name ?? "Unknown creator";
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E2D9] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {plate.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={plate.photo}
          alt={plate.name}
          className="h-32 w-full object-cover"
        />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-[#F0EEE6]">
          <UtensilsCrossed size={24} className="text-[#C9C4B6]" />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold leading-tight text-[#1F1E1D]">
            {plate.name}
          </p>
          <p className="flex-shrink-0 text-sm font-bold text-[#3E6B34]">
            {money(plate.priceDollars)}
          </p>
        </div>
        {plate.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-[#6B6862]">
            {plate.description}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {plate.status ? (
            <Chip tone={plate.status === "active" ? "green" : "neutral"}>
              {plate.status}
            </Chip>
          ) : null}
          {plate.fulfillment ? <Chip>{plate.fulfillment}</Chip> : null}
          {plate.orderCount > 0 ? <Chip>{plate.orderCount} orders</Chip> : null}
          {plate.categories.slice(0, 2).map((c) => (
            <Chip key={c}>#{c}</Chip>
          ))}
          {plate.allergens.length > 0 ? (
            <Chip tone="amber">
              <AlertTriangle size={10} />
              {plate.allergens.slice(0, 3).join(", ")}
            </Chip>
          ) : null}
        </div>
        <div className="mt-2.5 flex items-center gap-2 border-t border-[#EFEDE4] pt-2.5">
          <Avatar src={plate.creator.photo} alt={creatorLabel} size={24} />
          <span className="truncate text-xs font-medium text-[#3D3A34]">
            {creatorLabel}
          </span>
          {plate.creator.handle ? (
            <a
              href={`/${plate.creator.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-[#C15F3C] hover:text-[#A94F30]"
            >
              View <ExternalLink size={11} />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CreatorResultCard({ creator }: { creator: CreatorCard }) {
  const label = creator.handle
    ? `@${creator.handle}`
    : creator.name ?? "Unknown";
  const verified = creator.kyc === "verified";
  return (
    <div className="rounded-2xl border border-[#E5E2D9] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3">
        <Avatar src={creator.photo} alt={label} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold text-[#1F1E1D]">
              {creator.name ?? label}
            </p>
            {verified ? (
              <CheckCircle2 size={13} className="flex-shrink-0 text-[#3E6B34]" />
            ) : (
              <AlertTriangle size={13} className="flex-shrink-0 text-[#B8860B]" />
            )}
          </div>
          {creator.handle ? (
            <p className="truncate text-xs text-[#8A8578]">@{creator.handle}</p>
          ) : null}
          {creator.bio ? (
            <p className="mt-1 line-clamp-2 text-xs text-[#6B6862]">
              {creator.bio}
            </p>
          ) : null}
        </div>
        {creator.storefrontPath ? (
          <a
            href={creator.storefrontPath}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-shrink-0 items-center gap-1 text-[11px] font-semibold text-[#C15F3C] hover:text-[#A94F30]"
          >
            View <ExternalLink size={11} />
          </a>
        ) : null}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Chip tone={verified ? "green" : "amber"}>KYC {creator.kyc ?? "—"}</Chip>
        <Chip tone={creator.storefrontActive ? "green" : "neutral"}>
          <Store size={10} />
          {creator.storefrontActive ? "live" : "off"}
        </Chip>
        <Chip>
          <UtensilsCrossed size={10} />
          {creator.activeListingCount}/{creator.listingCount} plates
        </Chip>
        {creator.rating != null ? (
          <Chip>
            <Star size={10} className="text-[#B8860B]" />
            {creator.rating.toFixed(1)} ({creator.reviewCount})
          </Chip>
        ) : null}
        {creator.serviceZips.length > 0 ? (
          <Chip>
            <MapPin size={10} />
            {creator.serviceZips.slice(0, 2).join(", ")}
            {creator.serviceZips.length > 2
              ? ` +${creator.serviceZips.length - 2}`
              : ""}
          </Chip>
        ) : null}
      </div>
    </div>
  );
}
