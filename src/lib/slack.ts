/**
 * Slack poster for ops notifications (order receipt confirmations,
 * disputes).
 *
 * Same pattern as the beta-signup notifier: ONE incoming-webhook URL,
 * no bot token, no channel argument. The webhook is bound to its
 * destination channel when you create it, so posting is just a POST of
 * `{ text }` to that URL.
 *
 * Setup (one-time):
 *   1. https://api.slack.com/apps → your app → Incoming Webhooks → on
 *   2. Add New Webhook to Workspace → pick the ops/dispute channel
 *      (the one whose id is C0B9KNNSK4P)
 *   3. Copy the https://hooks.slack.com/services/... URL into Netlify
 *      env as ORDER_OPS_WEBHOOK_URL
 *
 * If the env var is unset (e.g. local dev), this is a quiet no-op — a
 * missing webhook must never break the order flow.
 *
 * Best-effort: resolves to a boolean, never throws. Callers can await
 * (to log) or fire-and-forget.
 */

export interface SlackMessage {
  /** Message text. Slack incoming webhooks accept mrkdwn here. */
  text: string;
}

/**
 * Post a message to the ops Slack channel via incoming webhook.
 * Returns true on success, false on any failure (missing URL, network
 * error, non-ok response). Never throws.
 */
export async function postToSlack(msg: SlackMessage): Promise<boolean> {
  const url = process.env.ORDER_OPS_WEBHOOK_URL;
  if (!url) {
    console.warn("[slack] ORDER_OPS_WEBHOOK_URL not set — skipping post");
    return false;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg.text }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      console.warn(`[slack] webhook returned ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[slack] webhook delivery failed", err);
    return false;
  }
}
