// Temporary dark pin — see src/app/(app)/layout.tsx for rationale. The public
// catering inquiry flow under a creator's handle still uses the original dark
// styling + token/glass classes. Pinning `dark` here (rather than on the
// [handle] root, which would catch the now-light storefront) keeps just this
// subtree rendering as the Liquid Glass dark theme. Remove once restyled.
export default function HandleCateringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="dark">{children}</div>;
}
