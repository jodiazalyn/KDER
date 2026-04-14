/**
 * Input validation utilities for server-side and client-side use.
 */

const PHONE_REGEX = /^\+1\d{10}$/;
const HANDLE_REGEX = /^[a-z0-9_]{3,30}$/;
const ZIP_REGEX = /^\d{5}$/;
const HTML_TAG_REGEX = /<[^>]*>/g;

export function validatePhone(phone: string): boolean {
  if (!phone || !phone.trim()) return false;
  return PHONE_REGEX.test(phone.trim());
}

export function validateHandle(handle: string): boolean {
  if (!handle || !handle.trim()) return false;
  return HANDLE_REGEX.test(handle.trim().toLowerCase());
}

export function validateZip(zip: string): boolean {
  if (!zip || !zip.trim()) return false;
  return ZIP_REGEX.test(zip.trim());
}

export function validatePrice(price: number): boolean {
  if (typeof price !== "number") return false;
  if (!Number.isFinite(price)) return false;
  return price > 0;
}

export function validateQuantity(quantity: number): boolean {
  if (typeof quantity !== "number") return false;
  if (!Number.isInteger(quantity)) return false;
  return quantity > 0 && quantity <= 9999;
}

/**
 * Sanitize user text input — trim + strip HTML tags.
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  return input.trim().replace(HTML_TAG_REGEX, "");
}

/**
 * Validate and sanitize a URL — reject javascript: URIs.
 */
export function sanitizeUrl(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:text/html")
  ) {
    return null;
  }
  return trimmed;
}
