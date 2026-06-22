/**
 * Lightweight client-side geo helpers for the pickup-distance feature.
 *
 * We deliberately avoid adding a maps SDK or any new dependency. The app
 * already reverse-geocodes via OpenStreetMap Nominatim in the checkout
 * flow (see CheckoutSheet), so we reuse the same free, key-less service
 * here for forward geocoding and compute straight-line distance locally
 * with the haversine formula. This is a "roughly how far am I" indicator,
 * not turn-by-turn routing — good enough to tell a customer whether the
 * pickup is around the corner or across town.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_MILES = 3958.8;

/** Great-circle ("as the crow flies") distance in miles between two points. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/** Human-friendly distance label, e.g. "0.3 mi", "2.4 mi", "18 mi". */
export function formatDistanceMiles(miles: number): string {
  if (!Number.isFinite(miles)) return "";
  if (miles < 0.1) return "less than 0.1 mi";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/**
 * Forward-geocode a free-text address to coordinates via Nominatim.
 * Returns null on any failure (network, no match, malformed response) so
 * callers can degrade gracefully. Pass an AbortSignal to cancel on unmount.
 */
export async function geocodeAddress(
  address: string,
  signal?: AbortSignal
): Promise<LatLng | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      q
    )}&format=jsonv2&limit=1&countrycodes=us`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const first = Array.isArray(data) ? data[0] : null;
    if (!first?.lat || !first?.lon) return null;
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Read the device's current position as a promise. Resolves null when the
 * API is unavailable, permission is denied, or the lookup times out.
 */
export function getCurrentPosition(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

/** Universal maps "directions to" deep link (opens Apple/Google Maps). */
export function mapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address.trim()
  )}`;
}
