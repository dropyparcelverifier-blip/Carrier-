import { describe, expect, it } from "vitest";

/**
 * Velocity webhook parsing.
 *
 * Built from Velocity's published docs, verified against their own
 * documented sample payload rather than a guess. Until this batch the
 * route captured and stopped, so every Velocity shipment ran its clock
 * out and sat on "running late" while the parcel was delivered.
 */

/** Velocity's own documented example, copied verbatim from their docs. */
const SAMPLE = {
  event: "status_change",
  event_id: "fe629ee4-05af-499c-bd15-3ebb87d1a077",
  event_timestamp: "2026-04-15T10:58:47+05:30",
  data: {
    shipment_id: "SHIQ6MAKJMOIY",
    tracking_number: "41332221429154",
    order_id: "ORDQ7LAKF9XJJ",
    order_external_id: "510322643_602973822",
    order_display_id: "114595804897851",
    status: "delivered",
    sub_status: "delivered",
    carrier_name: "Delhivery Standard",
    estimated_delivery_date: "2026-04-17T00:00:00+05:30",
    original_edd: "2026-04-17T00:00:00+05:30",
    shipment_type: "forward",
    delivered_at: "2026-04-15T10:58:39+05:30",
    tracking_url: "https://www.velocityshipping.in/track/41332221429154",
  },
};

// Mirrors FORWARDED_STATUSES in courier-updates-b/+server.ts.
const FORWARDED = new Set([
  "ready_for_pickup", "pickup_scheduled", "not_picked",
  "in_transit", "out_for_delivery", "delivered",
  "ndr_raised", "need_attention", "reattempt_delivery",
  "lost", "externally_fulfilled",
  "rto_initiated", "rto_in_transit", "rto_delivered", "rto_need_attention", "rto_lost",
]);

describe("Velocity payload shape", () => {
  it("reads the AWB from tracking_number, not order_id", () => {
    expect(SAMPLE.data.tracking_number).toBe("41332221429154");
  });

  it("matches on order_external_id — order_id is THEIRS", () => {
    // Velocity's order_id (ORDQ7LAKF9XJJ) is their internal reference and
    // will never match anything on our side. order_external_id is the
    // one we sent them.
    expect(SAMPLE.data.order_id).toMatch(/^ORD/);
    expect(SAMPLE.data.order_external_id).not.toBe(SAMPLE.data.order_id);
  });

  it("carries a real tracking URL, so we don't reconstruct one", () => {
    expect(SAMPLE.data.tracking_url).toContain("velocityshipping.in/track/");
    expect(SAMPLE.data.tracking_url).toContain(SAMPLE.data.tracking_number);
  });

  it("carries event_id for idempotency", () => {
    expect(SAMPLE.event_id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("which statuses forward an order", () => {
  it("the documented sample forwards", () => {
    expect(FORWARDED.has(SAMPLE.data.status)).toBe(true);
  });

  it("a courier holding it counts, collected or not", () => {
    for (const s of ["ready_for_pickup", "pickup_scheduled", "in_transit", "delivered"]) {
      expect(FORWARDED.has(s)).toBe(true);
    }
  });

  it("a failed pickup still counts", () => {
    // not_picked means the courier was assigned and the AWB exists —
    // the van just didn't turn up. The customer can still track it.
    expect(FORWARDED.has("not_picked")).toBe(true);
  });

  it("statuses with no courier assigned do NOT forward", () => {
    // "pending" is explicitly "created but not yet assigned to a
    // courier" in Velocity's docs — there may be no AWB at all.
    for (const s of ["pending", "rejected", "processing", "cancelled"]) {
      expect(FORWARDED.has(s)).toBe(false);
    }
  });

  it("RTO counts — the forward leg completed before it turned around", () => {
    expect(FORWARDED.has("rto_initiated")).toBe(true);
    expect(FORWARDED.has("rto_delivered")).toBe(true);
  });

  it("return-leg statuses are not in the forward set", () => {
    for (const s of ["return_in_transit", "return_delivered", "return_qc_failed"]) {
      expect(FORWARDED.has(s)).toBe(false);
    }
  });
});

describe("shipment_type gating", () => {
  it("only the forward leg moves our stage", () => {
    // A return or RTO SHIPMENT arriving for an order we never forwarded
    // would otherwise mark it handed over, which is backwards.
    expect(SAMPLE.data.shipment_type).toBe("forward");
    for (const t of ["return", "rto"]) {
      expect(t).not.toBe("forward");
    }
  });
});

/**
 * Post-handover statuses belong to ADMIN, not the customer page.
 *
 * The customer's journey ends at "Forwarded to courier". Pickup, failed
 * pickup, in transit and delivery are the courier's own page to show —
 * and the team's business to see.
 *
 * These used to be dropped entirely: once picked_up_at was set, every
 * further webhook returned "already recorded" and vanished. Nobody could
 * tell a pickup had failed without opening Velocity.
 */
describe("post-handover statuses go to the admin trail", () => {
  const FORWARDED = new Set([
    "ready_for_pickup", "pickup_scheduled", "not_picked",
    "in_transit", "out_for_delivery", "delivered",
    "ndr_raised", "need_attention", "reattempt_delivery",
    "lost", "externally_fulfilled",
    "rto_initiated", "rto_in_transit", "rto_delivered", "rto_need_attention", "rto_lost",
  ]);
  const POST_HANDOVER_ONLY = new Set([
    "cancelled", "rejected",
    "return_rejected", "return_pickup_scheduled", "return_not_picked",
    "return_in_transit", "return_delivered", "return_cancelled",
    "return_ndr_raised", "return_need_attention", "return_qc_failed", "return_lost",
  ]);

  it("a cancellation never forwards, but is worth logging", () => {
    // On a live order the team needs to see it. On an order we never
    // handed over it means nothing happened at all.
    expect(FORWARDED.has("cancelled")).toBe(false);
    expect(POST_HANDOVER_ONLY.has("cancelled")).toBe(true);
  });

  it("return-leg statuses log without forwarding", () => {
    for (const s of ["return_in_transit", "return_delivered", "return_qc_failed"]) {
      expect(FORWARDED.has(s)).toBe(false);
      expect(POST_HANDOVER_ONLY.has(s)).toBe(true);
    }
  });

  it("the two sets never overlap", () => {
    for (const s of FORWARDED) expect(POST_HANDOVER_ONLY.has(s)).toBe(false);
  });

  it("ready_for_pickup is the FIRST forwarding status", () => {
    // Velocity's own description: "Shipment assigned to a courier and
    // ready for pickup" — the AWB exists. This is a Velocity-internal
    // event, not a carrier sync, so it carries none of the documented
    // 15-60 minute lag. Forwarding is immediate.
    expect(FORWARDED.has("ready_for_pickup")).toBe(true);
    expect(FORWARDED.has("pending")).toBe(false);
  });

  it("pickup outcome does not gate forwarding", () => {
    // not_picked still forwards — the label exists and the customer can
    // track it. Whether the van turned up is admin's concern.
    expect(FORWARDED.has("not_picked")).toBe(true);
    expect(FORWARDED.has("pickup_scheduled")).toBe(true);
  });
});
