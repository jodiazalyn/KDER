// Temporary dark pin. This route still uses the original Liquid Glass dark
// styling (hardcoded dark hex + token/glass classes). The shared (app) shell
// now follows the global light theme (the dashboard is restyled), so this
// sub-layout re-pins just this route to dark — including a dark background, as
// some pages here rely on the shell for it — until the route is restyled.
// Remove this file once this surface is converted to the light theme.
export default function SettingsDarkPinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="dark min-h-[100dvh] bg-[#0A0A0A]">{children}</div>;
}
