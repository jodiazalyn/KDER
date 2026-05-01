import { PageTransition } from "@/components/ui/page-transition";

/**
 * Templates re-mount on every route change inside the (app) shell.
 * This is the hook framer-motion's AnimatePresence needs to drive
 * page-level slide transitions.
 *
 * Public marketing pages (landing, /privacy, /terms, /sms-policy) are
 * outside this group and stay static for SEO + perceived performance.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
