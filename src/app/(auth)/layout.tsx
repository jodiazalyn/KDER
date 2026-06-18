// The signup flow (phone → OTP verify → waitlist) is restyled to the light
// brand aesthetic, so it follows the global light/dark theme rather than being
// pinned dark. Each page uses token + glass classes that resolve per-theme.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
