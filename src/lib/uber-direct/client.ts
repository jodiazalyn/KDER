/**
 * Uber Direct API client — auth + request helper.
 *
 * Handles:
 *   - OAuth2 client_credentials grant against
 *     https://auth.uber.com/oauth/v2/token (scope:
 *     `eats.deliveries`)
 *   - In-memory token cache (15-min TTL minus 60s safety
 *     margin) so we don't fetch a new token per request
 *   - One retry on 5xx (no retry on 4xx — those are
 *     deterministic and a retry will re-fail)
 *   - Structured logging with the X-Request-Id Uber returns,
 *     so failed calls can be looked up in Uber's dashboard
 *
 * Env vars consumed:
 *   - UBER_DIRECT_CLIENT_ID
 *   - UBER_DIRECT_CLIENT_SECRET
 *   - UBER_DIRECT_CUSTOMER_ID
 *   - UBER_DIRECT_ENV (`sandbox` | `prod`, default `sandbox`)
 *
 * The sandbox base URL isn't published in the OpenAPI spec;
 * confirm from Uber's dashboard at setup time. Default below is
 * a best-guess — fix on Day 1 of Phase 1 smoke testing.
 */

const OAUTH_TOKEN_URL = "https://auth.uber.com/oauth/v2/token";
const OAUTH_SCOPE = "eats.deliveries";

const PROD_BASE = "https://api.uber.com/v1";
// Best guess; confirm in dashboard before flipping
// UBER_DIRECT_ENV=sandbox in production.
const SANDBOX_BASE = "https://sandbox-api.uber.com/v1";

interface TokenCache {
  accessToken: string;
  /** Epoch ms; subtract a 60s safety margin from Uber's exp. */
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

function baseUrl(): string {
  const env = process.env.UBER_DIRECT_ENV ?? "sandbox";
  return env === "prod" ? PROD_BASE : SANDBOX_BASE;
}

function customerId(): string {
  const id = process.env.UBER_DIRECT_CUSTOMER_ID;
  if (!id) {
    throw new Error(
      "UBER_DIRECT_CUSTOMER_ID not set — Uber Direct integration disabled."
    );
  }
  return id;
}

async function fetchAccessToken(): Promise<TokenCache> {
  const clientId = process.env.UBER_DIRECT_CLIENT_ID;
  const clientSecret = process.env.UBER_DIRECT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "UBER_DIRECT_CLIENT_ID / UBER_DIRECT_CLIENT_SECRET not set."
    );
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: OAUTH_SCOPE,
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Uber OAuth token request failed (${res.status}): ${text}`
    );
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  const expiresAt = Date.now() + (json.expires_in - 60) * 1000;
  return { accessToken: json.access_token, expiresAt };
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }
  tokenCache = await fetchAccessToken();
  return tokenCache.accessToken;
}

/** Force a token refresh on next call. Used by `uberRequest()`
 *  on a 401 to handle the rare race where Uber rotates our key
 *  while a request is in flight. */
export function invalidateAccessToken() {
  tokenCache = null;
}

interface RequestOpts {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  op: string;
}

/**
 * Low-level Uber Direct request helper. Used by quote /
 * create-delivery / cancel-delivery wrappers. Adds auth, JSON
 * encoding, one 5xx retry, request-id logging.
 *
 * Throws on non-2xx with a structured Error that includes
 * Uber's X-Request-Id when present.
 */
export async function uberRequest<T>(opts: RequestOpts): Promise<T> {
  const cid = customerId();
  const url =
    baseUrl() +
    "/" +
    opts.path.replace(/^\//, "").replace("{customer_id}", cid);

  const doRequest = async (attempt: number): Promise<T> => {
    const token = await getAccessToken();
    // Diagnostic: print env + host + cid prefix on every Uber call.
    // Catches the "I thought I was on sandbox but my env vars point
    // at prod" class of bug (which is exactly how we discovered our
    // disabled-prod-account false alarm — UBER_DIRECT_ENV was set
    // to sandbox but UBER_DIRECT_CUSTOMER_ID belonged to the prod
    // account). Cheap to keep around: one log line per Uber API call.
    const env = process.env.UBER_DIRECT_ENV ?? "sandbox";
    const host = new URL(url).host;
    console.log(
      `[uber-direct.${opts.op}] env=${env} host=${host} cid=${cid.slice(0, 8)} attempt=${attempt}`
    );
    const res = await fetch(url, {
      method: opts.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const requestId = res.headers.get("x-request-id") ?? null;

    if (res.status === 401 && attempt === 0) {
      invalidateAccessToken();
      return doRequest(attempt + 1);
    }
    if (res.status >= 500 && attempt === 0) {
      return doRequest(attempt + 1);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[uber-direct.${opts.op}] non-2xx ${res.status} request_id=${requestId} body=${text.slice(0, 500)}`
      );
      throw new UberApiError(
        opts.op,
        res.status,
        text,
        requestId,
        `Uber Direct ${opts.op} failed: HTTP ${res.status}${
          requestId ? ` (request_id=${requestId})` : ""
        }`
      );
    }

    return (await res.json()) as T;
  };

  return doRequest(0);
}

/** Structured error type for Uber API failures. Lets the helper
 *  layer match on `.status` + parse `.body` to detect known
 *  recoverable cases (expired quote, no courier, out-of-coverage)
 *  rather than re-parsing the message string. */
export class UberApiError extends Error {
  readonly op: string;
  readonly status: number;
  readonly body: string;
  readonly requestId: string | null;
  constructor(
    op: string,
    status: number,
    body: string,
    requestId: string | null,
    message: string
  ) {
    super(message);
    this.name = "UberApiError";
    this.op = op;
    this.status = status;
    this.body = body;
    this.requestId = requestId;
  }
  /** Best-effort parse of the body as JSON; returns null on
   *  parse failure so callers can use optional-chaining. */
  parsedBody(): Record<string, unknown> | null {
    try {
      return JSON.parse(this.body) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export function getCustomerId(): string {
  return customerId();
}
