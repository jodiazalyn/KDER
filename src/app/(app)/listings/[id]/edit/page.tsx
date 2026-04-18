"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PlateForm } from "@/components/listings/PlateForm";
import type { Listing } from "@/types";

export default function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "not-found">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/listings/${id}`);
        if (!res.ok) {
          if (!cancelled) setStatus("not-found");
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        if (json?.data?.listing) {
          setListing(json.data.listing as Listing);
          setStatus("loaded");
        } else {
          setStatus("not-found");
        }
      } catch {
        if (!cancelled) setStatus("not-found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (status === "not-found") {
      router.replace("/listings");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <Loader2 size={28} className="animate-spin text-white/40" />
      </div>
    );
  }

  if (!listing) return null;

  return <PlateForm listing={listing} />;
}
