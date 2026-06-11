import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyUberWebhook } from "@/lib/uber-direct/verify-webhook";
import {
  decideStatusUpdate,
  extractDeliveryEvent,
  isDeliveryStatus,
} from "@/lib/uber-direct/webhook-event";
import type { UberWebhookEnvelope } from "@/lib/uber-direct/types";

const SECRET = "test-signing-secret";

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

describe("verifyUberWebhook", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ kind: "event.delivery_status" });
    expect(
      verifyUberWebhook({
        rawBody: body,
        headers: { "x-uber-signature": sign(body) },
        secret: SECRET,
      })
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ kind: "event.delivery_status" });
    const sig = sign(body);
    expect(
      verifyUberWebhook({
        rawBody: body + " ",
        headers: { "x-uber-signature": sig },
        secret: SECRET,
      })
    ).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const body = "{}";
    expect(
      verifyUberWebhook({
        rawBody: body,
        headers: { "x-uber-signature": sign(body, "other") },
        secret: SECRET,
      })
    ).toBe(false);
  });

  it("rejects a missing signature header or empty secret", () => {
    const body = "{}";
    expect(
      verifyUberWebhook({
        rawBody: body,
        headers: { "x-uber-signature": null },
        secret: SECRET,
      })
    ).toBe(false);
    expect(
      verifyUberWebhook({
        rawBody: body,
        headers: { "x-uber-signature": sign(body) },
        secret: "",
      })
    ).toBe(false);
  });
});

describe("isDeliveryStatus", () => {
  it("accepts known statuses and rejects junk", () => {
    expect(isDeliveryStatus("delivered")).toBe(true);
    expect(isDeliveryStatus("pickup_complete")).toBe(true);
    expect(isDeliveryStatus("in_transit")).toBe(false);
    expect(isDeliveryStatus(undefined)).toBe(false);
  });
});

describe("extractDeliveryEvent", () => {
  it("pulls status, ids, tracking url and event time from a status event", () => {
    const envelope: UberWebhookEnvelope = {
      kind: "event.delivery_status",
      event_time: "2026-06-08T12:00:00.000Z",
      delivery_id: "del_abc",
      data: {
        id: "del_abc",
        status: "pickup",
        external_id: "order-123",
        tracking_url: "https://track.uber.com/del_abc",
      },
    };
    const ev = extractDeliveryEvent(envelope);
    expect(ev.status).toBe("pickup");
    expect(ev.deliveryId).toBe("del_abc");
    expect(ev.externalId).toBe("order-123");
    expect(ev.trackingUrl).toBe("https://track.uber.com/del_abc");
    expect(ev.eventTimeMs).toBe(Date.parse("2026-06-08T12:00:00.000Z"));
  });

  it("normalizes epoch-second event_time to ms", () => {
    const ev = extractDeliveryEvent({
      kind: "event.delivery_status",
      event_time: 1_700_000_000 as unknown as string,
      data: { id: "del_x", status: "delivered" },
    });
    expect(ev.eventTimeMs).toBe(1_700_000_000_000);
  });

  it("returns undefined status for unknown status / non-status events", () => {
    // Cast: the envelope type only models known statuses, but at runtime
    // Uber can send statuses we don't recognize (e.g. courier pings) — the
    // extractor must defensively drop them.
    const unknownStatusEvent = {
      kind: "event.courier_update",
      data: { id: "del_x", status: "courier_moving" },
    } as unknown as UberWebhookEnvelope;
    expect(extractDeliveryEvent(unknownStatusEvent).status).toBeUndefined();
    expect(extractDeliveryEvent({ kind: "ping" }).status).toBeUndefined();
  });

  it("falls back to top-level delivery_id when data.id is absent", () => {
    const ev = extractDeliveryEvent({
      kind: "event.delivery_status",
      delivery_id: "del_top",
      data: { status: "dropoff" },
    });
    expect(ev.deliveryId).toBe("del_top");
  });
});

describe("decideStatusUpdate", () => {
  const at = "2026-06-08T12:00:00.000Z";

  it("applies a normal forward transition", () => {
    expect(
      decideStatusUpdate(
        { uber_status: "pending", uber_status_updated_at: at },
        { status: "pickup" }
      )
    ).toEqual({ apply: true, reason: "ok" });
  });

  it("skips a no-op repeat of the same status", () => {
    expect(
      decideStatusUpdate(
        { uber_status: "pickup", uber_status_updated_at: at },
        { status: "pickup" }
      ).apply
    ).toBe(false);
  });

  it("never moves out of a terminal status", () => {
    expect(
      decideStatusUpdate(
        { uber_status: "delivered", uber_status_updated_at: at },
        { status: "dropoff" }
      )
    ).toEqual({ apply: false, reason: "post-terminal" });
    expect(
      decideStatusUpdate(
        { uber_status: "canceled", uber_status_updated_at: at },
        { status: "canceled" }
      )
    ).toEqual({ apply: false, reason: "duplicate-terminal" });
  });

  it("drops a stale out-of-order event by timestamp", () => {
    const newer = Date.parse("2026-06-08T12:05:00.000Z");
    const older = Date.parse("2026-06-08T12:01:00.000Z");
    expect(
      decideStatusUpdate(
        {
          uber_status: "dropoff",
          uber_status_updated_at: new Date(newer).toISOString(),
        },
        { status: "pickup_complete", eventTimeMs: older }
      )
    ).toEqual({ apply: false, reason: "stale-event" });
  });

  it("applies when stored status is null (first webhook)", () => {
    expect(
      decideStatusUpdate(
        { uber_status: null, uber_status_updated_at: null },
        { status: "pending" }
      ).apply
    ).toBe(true);
  });
});
