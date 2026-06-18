// Temporary dark pin — see src/app/(app)/layout.tsx for rationale. The order
// confirmation screen still uses the original dark styling + token/glass
// classes; pinning `dark` keeps it rendering as the Liquid Glass dark theme
// under the new light global default. Remove once it is restyled to light.
export default function OrderConfirmationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="dark">{children}</div>;
}
