import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";
import { sendSms } from "@/lib/twilio";
import { notifyNewMessage } from "@/lib/notifications";

export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return apiError("Failed to fetch messages.", 500);

    return apiSuccess({ messages: data });
  } catch {
    return apiError("Failed to fetch messages.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { recipient_id, body, order_id, media_url } = await request.json();

    if (!recipient_id || !body) {
      return apiError("Recipient and message body are required.", 400);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Unauthorized. Please sign in.", 401);
    }
    const senderId = user.id;

    // Insert message to Supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: msg, error } = await (supabase.from("messages") as any)
      .insert({
        sender_id: senderId,
        recipient_id,
        body: body.trim(),
        order_id: order_id || null,
        media_url: media_url || null,
      })
      .select()
      .single();

    if (error) {
      return apiError("Failed to send message.", 500);
    }

    // Fetch recipient details for SMS + email (one query for both).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recipientRow } = await (supabase.from("members") as any)
      .select("phone, email, display_name")
      .eq("id", recipient_id)
      .single();

    // Fetch sender name for the notification copy.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: senderRow } = await (supabase.from("members") as any)
      .select("display_name")
      .eq("id", senderId)
      .single();

    const senderName: string = senderRow?.display_name ?? "Someone";

    if (recipientRow?.phone) {
      await sendSms(
        recipientRow.phone as string,
        `KDER: new message from ${senderName} — "${body.trim().slice(0, 100)}"`
      );
    }

    // Email the recipient so they don't miss the message if they're not
    // actively in the app. Fire-and-forget; never blocks the response.
    notifyNewMessage({
      recipientEmail: recipientRow?.email ?? null,
      senderName,
      messagePreview: body.trim(),
      orderId: order_id ?? null,
      creatorHandle: null,
    }).catch((err) => console.error("[messages] email notify threw:", err));

    // Return the full inserted row so the client can reconcile its optimistic
    // insert immediately, rather than waiting for Realtime to echo the message.
    return apiSuccess({ message: msg, message_id: msg.id });
  } catch {
    return apiError("Failed to send message.", 500);
  }
}
