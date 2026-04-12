import { StorefrontClient } from "./storefront-client";

interface StorefrontPageProps {
  params: Promise<{ handle: string }>;
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { handle } = await params;
  // Strip @ prefix and decode URI component (handles %40 encoding)
  const cleanHandle = decodeURIComponent(handle).replace(/^@/, "");

  return <StorefrontClient handle={cleanHandle} />;
}
