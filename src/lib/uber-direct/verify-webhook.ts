import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a webhook from Uber Direct.
 *
 * NOTE: Uber's webhook signing scheme isn't published in the
 * OpenAPI spec (the spec only covers the REST API). The exact
 * header name + signing algorithm are documented in the Direct
 * dashboard webhooks page. Defaults below are educated guesses
 * based on the industry norm (HMAC-SHA256 of the raw body,
 * passed in `X-Uber-Signature` as a hex digest); confirm + fix
 * at the start of Phase 3 when we wire the webhook route.
 */

const HEADER_NAME = "x-uber-signature";

export interface VerifyArgs {
  /** The raw request body bytes (NOT the parsed JSON). The
   *  signature is computed over the bytes as transmitted. */
  rawBody: string;
  /** Case-insensitive HTTP headers from the incoming webhook. */
  headers: Record<string, string | null>;
  /** UBER_DIRECT_WEBHOOK_SECRET from env. */
  secret: string;
}

export function verifyUberWebhook(args: VerifyArgs): boolean {
  if (!args.secret) return false;
  const provided =
    args.headers[HEADER_NAME] ?? args.headers[HEADER_NAME.toUpperCase()];
  if (!provided) return false;

  const expected = createHmac("sha256", args.secret)
    .update(args.rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
