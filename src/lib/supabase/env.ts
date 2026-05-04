/**
 * Validated Supabase env vars. Import the constants from here instead of
 * reaching for `process.env.NEXT_PUBLIC_SUPABASE_*!` so missing config
 * fails loudly (production runtime: hard throw; dev: clear console error)
 * rather than silently producing a non-functional Supabase client.
 *
 * The check is intentionally skipped during `next build` because vars are
 * typically injected at deploy/runtime (Vercel, etc.) — failing the build
 * just because a CI env doesn't have local secrets would be wrong.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!isBuildPhase && (!url || !anonKey)) {
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]
    .filter(Boolean)
    .join(", ");
  const message = `[supabase] Missing env var(s): ${missing}. Copy .env.local.example → .env.local and fill in your Supabase project keys.`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  } else {
    console.error(message);
  }
}

export const SUPABASE_URL = url ?? "";
export const SUPABASE_ANON_KEY = anonKey ?? "";
