import { NextRequest } from "next/server";

/**
 * Twilio incoming SMS webhook.
 *
 * When a member replies to an SMS, Twilio sends a POST here.
 * We look up the member by phone, find the active conversation,
 * and insert the message into Supabase.
 *
 * Configure webhook URL in Twilio Console:
 *   https://your-domain.com/api/v1/messages/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;

    if (!from || !body) {
      return new Response("<Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Look up member by phone number
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: member } = await (supabase.from("members") as any)
      .select("id")
      .eq("phone", from)
      .single() as { data: { id: string } | null };

    if (!member) {
      // Unknown number — acknowledge but don't process
      return new Response("<Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Find the most recent conversation partner (creator) for this member
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastMsg } = await (supabase.from("messages") as any)
      .select("sender_id, recipient_id, order_id")
      .or(
        `sender_id.eq.${member.id},recipient_id.eq.${member.id}`
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .single() as { data: { sender_id: string; recipient_id: string; order_id: string | null } | null };

    if (!lastMsg) {
      return new Response("<Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const recipientId =
      lastMsg.sender_id === member.id
        ? lastMsg.recipient_id
        : lastMsg.sender_id;

    // Insert the incoming message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("messages") as any).insert({
      sender_id: member.id,
      recipient_id: recipientId,
      order_id: lastMsg.order_id,
      body: body.trim(),
    });

    // Return empty TwiML response
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch {
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
