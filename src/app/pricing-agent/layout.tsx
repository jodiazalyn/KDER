// Temporary dark pin — see src/app/(app)/layout.tsx for rationale. The pricing
// agent surface still uses the original dark styling + token/glass classes;
// pinning `dark` keeps it rendering as the Liquid Glass dark theme under the
// new light global default. Remove once this surface is restyled to light.
export default function PricingAgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="dark">{children}</div>;
}
