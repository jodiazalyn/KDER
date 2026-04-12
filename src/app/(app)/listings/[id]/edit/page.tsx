"use client";

import { use } from "react";
import { redirect } from "next/navigation";
import { PlateForm } from "@/components/listings/PlateForm";
import { getListing } from "@/lib/listings-store";

export default function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const listing = getListing(id);

  if (!listing) {
    redirect("/listings");
  }

  return <PlateForm listing={listing} />;
}
