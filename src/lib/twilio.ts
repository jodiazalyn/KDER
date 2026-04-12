/**
 * Twilio Programmable Messaging client wrapper.
 *
 * Sends SMS when Twilio credentials are configured.
 * Falls back silently when credentials are missing (dev mode).
 *
 * Required env vars:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER
 */

export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

export async function sendSms(
  to: string,
  body: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!isTwilioConfigured()) {
    console.log("[Twilio] Not configured — skipping SMS to", to);
    return { success: true, sid: "demo_skipped" };
  }

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_PHONE_NUMBER!;

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err.message || "SMS failed" };
    }

    const data = await res.json();
    return { success: true, sid: data.sid };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "SMS failed",
    };
  }
}
