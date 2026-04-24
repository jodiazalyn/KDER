import Anthropic from "@anthropic-ai/sdk";

/**
 * Lazy-init Anthropic client.
 *
 * Reads `ANTHROPIC_API_KEY` at *call time*, not module load, so Netlify cold
 * starts tolerate env changes without a redeploy. Falls back to `undefined`
 * when missing — the route handler detects this and returns a clean 503 so
 * the creator's textarea stays manually editable.
 */

let cached: Anthropic | null = null;

export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  if (cached) return cached;

  cached = new Anthropic({ apiKey });
  return cached;
}

/**
 * Model string lives in env so we can downgrade Sonnet → Haiku in one
 * Netlify env-var change if cost becomes an issue (ADR-4 in the plan).
 */
export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
}
