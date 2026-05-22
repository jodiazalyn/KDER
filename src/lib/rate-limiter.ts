/**
 * In-memory sliding window rate limiter.
 * Each key (e.g. phone number) gets its own window.
 * Entries auto-expire after the window duration.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/**
 * Check if a request is allowed under the rate limit.
 * @param key - Unique identifier (e.g., phone number, IP)
 * @param maxRequests - Max requests allowed in the window
 * @param windowMs - Window duration in milliseconds
 * @returns { allowed: boolean, remaining: number, retryAfterMs: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  cleanup(windowMs);

  const now = Date.now();
  const entry = store.get(key) || { timestamps: [] };

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  entry.timestamps.push(now);
  store.set(key, entry);

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  };
}

// Rate limit configs.
//
// Twilio Verify enforces its OWN per-recipient ceilings server-side
// (≈5 sends per phone per 10min plus a daily cap, and 5 wrong-check
// attempts per individual verification). Our app-level limits below
// run BEFORE we touch Supabase/Twilio — they exist as a fast-path
// 429 to bounce abuse before paying for the round trip. The numbers
// are intentionally close to Verify's limits so users hit "real"
// caps on the same rough timeline regardless of which layer trips
// first.
export const OTP_REQUEST_LIMIT = { maxRequests: 5, windowMs: 10 * 60 * 1000 }; // 5 per 10 min
export const OTP_VERIFY_LIMIT = { maxRequests: 10, windowMs: 10 * 60 * 1000 }; // 10 per 10 min (across multiple verifications)

/** Reset rate limiter (for testing only) */
export function _resetForTesting() {
  store.clear();
}
