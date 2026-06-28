import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KDER Club — Interactive Tour",
  description:
    "A clickable walkthrough of KDER for foodies, creators, and restaurants — plates, catering, delivery, Mia, Cleopatra VII, payments, and more.",
};

/**
 * The tutorial is a self-contained HTML document (its own styles + inline
 * script for the persona switcher and live phone screens). React does not
 * execute scripts injected as HTML strings, so rather than port it into a
 * component we serve the file statically from `public/tutorial.html` and
 * embed it full-viewport here. Source of truth lives outside the app at
 * kder-tutorial.html; re-copy into public/ on update.
 */
export default function TutorialPage() {
  return (
    <iframe
      src="/tutorial.html"
      title="KDER Club — Interactive Tour"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: 0,
      }}
    />
  );
}
