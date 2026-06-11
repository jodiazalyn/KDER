/**
 * Slack poster for ops notifications (order receipt confirmations,
 * disputes).
 *
 * Unlike the beta-signup notifier (which uses an incoming-webhook URL
 * bound to a single channel), this posts to a specific channel BY ID
 * via the Web API `chat.postMessage`. That requires a bot token, not a
 * webhook URL — the channel id `C0B9KNNSK4P` only makes sense as a
 * `channel` argument to the API.
 *
 * Config (both required, else this is a quiet no-op):
 *   - SLACK_BOT_TOKEN   — a bot token (xoxb-…) with chat:write scope,
 *                         invited to the destination channel.
 *   - SLACK_OPS_CHANNEL — channel id to post into. Defaults to the
 *                         ops dispute channel if unset.
 *
 * Best-effort by design: a Slack failure must NEVER break the order
 * flow. Callers can `await` (to log the result) or fire-and-forget;
 * either way this resolves to a boolean and never throws.
 */

const DEFAULT_OPS_CHANNEL = "C0B9KNNSK4P";

export interface SlackMessage {
  /** Plain-text fallback / notification text. */
  text: string;
  /** Optional Block Kit blocks for richer formatting. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks?: any[];
  /** Override the destination channel id. Defaults to env / ops channel. */
  channel?: string;
}

/**
 * Post a message to Slack. Returns true on success, false on any
 * failure (missing config, network error, non-ok API response).
 * Never throws.
 */
export async function postToSlack(msg: SlackMessage): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn("[slack] SLACK_BOT_TOKEN not set — skipping post");
    return false;
  }

  const channel =
    msg.channel ?? process.env.SLACK_OPS_CHANNEL ?? DEFAULT_OPS_CHANNEL;

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel,
        text: msg.text,
        ...(msg.blocks ? { blocks: msg.blocks } : {}),
      }),
      signal: AbortSignal.timeout(4000),
    });

    // Slack always returns HTTP 200; the real status is in the JSON
    // body's `ok` field (e.g. `channel_not_found`, `not_in_channel`).
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (!json?.ok) {
      console.warn(
        `[slack] postMessage failed: ${json?.error ?? `http ${res.status}`}`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[slack] postMessage threw", err);
    return false;
  }
}
