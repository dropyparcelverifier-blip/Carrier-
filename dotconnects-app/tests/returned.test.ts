import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { journeyView } from "$lib/journey";
import { mapRow } from "$lib/server/shipment-service";
import { stageToStatus } from "$lib/admin-stages";
import { statusStyle } from "$lib/status";

/* ═══════════════════════════════════════════════════
   RTO — the parcel is coming back.

   The customer's journey ends at handed_to_courier, so a returning
   parcel sat there saying "with the courier": true, but pointed the
   wrong way, with a delivery date for a delivery that had already
   failed. Nothing on the page could ever contradict it.

   It is NOT a fifteenth stage. Every stage is a step closer to the
   customer and this is a reversal, so it joins damaged and cancelled as
   a hold — and every layer that reads a hold has to know about it. The
   one that bit before was stageToStatus: with no entry, 'exception'
   fell through to "Order Placed" and told a box over the Atlantic that
   it had just been ordered.
   ═══════════════════════════════════════════════════ */

const ROW = {
  current_stage: "returned",
  route_key: null,
  order_date: "2026-09-18T06:00:00.000Z",
  shipping_days: 12,
  timing_seed: 12345,
  held_at: "2026-09-19T09:00:00.000Z",
};

describe("every layer that reads a hold knows this one", () => {
  it("has a status string of its own", () => {
    /* Without this it falls to "Order Placed", and the customer page
       derives its branches FROM this string. */
    expect(stageToStatus("returned")).toBe("Returned to us");
    expect(stageToStatus("returned")).not.toBe("Order Placed");
  });

  it("has a colour of its own", () => {
    /* Amber, not the neutral grey of "Order Placed" — and not the red
       of damaged, because a return is being handled, not destroyed. */
    expect(statusStyle("Returned to us")).not.toEqual(statusStyle("Order Placed"));
    expect(statusStyle("Returned to us")).not.toEqual(statusStyle("Damaged in transit"));
  });

  it("has a headline of its own", () => {
    const src = readFileSync("src/lib/greeting.ts", "utf8");
    expect(src).toMatch(/"Returned to us":/);
  });

  it("has a customer trail entry of its own", () => {
    /* recordHoldEvent writes the timeline the page renders. Without an
       entry the parcel's last update stays "handed to courier". */
    const src = readFileSync("src/lib/server/hold-event.ts", "utf8");
    expect(src).toMatch(/returned: \{/);
    expect(src).toMatch(/"cancelled" \| "damaged" \| "returned"/);
  });
});

describe("journeyView on a returned parcel", () => {
  it("reports returned, and is neither frozen nor capped", () => {
    /* Frozen means the box no longer exists. Capped describes one still
       heading toward the warehouse on its first pass. This is a real
       box, moving, the wrong way. */
    const v = journeyView(ROW, null);
    expect(v.returned).toBe(true);
    expect(v.frozen).toBe(false);
    expect(v.capped).toBe(false);
    expect(v.closed).toBe(false);
  });

  it("pins the journey at the handover rather than reading the clock", () => {
    /* An RTO only exists because a courier had the box. Reading the
       clock at held_at is the damaged branch's rule and would place a
       returning parcel mid-Atlantic on a same-day order. */
    expect(journeyView(ROW, null).journey).toBe("handed_to_courier");
    expect(journeyView({ ...ROW, held_at: null }, null).journey).toBe("handed_to_courier");
  });

  it("leaves every other state alone", () => {
    for (const stage of ["cancelled", "damaged", "customs_cleared", "qc_check"]) {
      expect(journeyView({ ...ROW, current_stage: stage }, null).returned).toBe(false);
    }
  });
});

const FULL = {
  id: 9, tracking_id: "USLMU6TCM940605844", dropy_order_id: "Dropy-5481",
  customer_name: "Box Sensei", customer_mobile: "9876543210",
  customer_city: "Navi Mumbai",
  items: [{ name: "CeraVe Moisturising Cream", qty: 1, weight_kg: 0.52, price_usd: 18 }],
  total_weight_kg: 0.52, total_items: 1, declared_value_usd: 18,
  shipping_days: 12, shipping_mode: "Air Freight",
  route_key: null, timing_seed: 12345, status: "Returned to us", progress: 100,
  estimated_delivery: "03 Oct 2026", carrier_name: "", awb_number: null, admin_notes: null,
  last_mile_courier: "velocity", last_mile_awb: "7D140804346",
  last_mile_tracking_url: null,
  last_mile_edd: "2026-09-21T00:00:00+05:30", last_mile_original_edd: null,
  order_date: "2026-09-18T06:00:00.000Z",
  clock_anchor_stage: null, clock_anchor_at: null,
  delivered_at: null, dropy_order_events: [],
  current_stage: "returned",
  held_at: "2026-09-19T09:00:00.000Z",
  label_generated_at: "2026-09-18T12:28:00.000Z",
  picked_up_at: "2026-09-18T12:35:00.000Z",
};

describe("the card on a returned parcel", () => {
  it("carries no date in either field", () => {
    /* Any date here is a delivery promise for a delivery that already
       failed — including the courier's own EDD. */
    const out = mapRow(FULL as any);
    expect(out.returned).toBe(true);
    expect(out.eta).toBe("");
    expect(out.doorstepEta).toBe("");
  });

  it("does not read as cancelled or damaged", () => {
    const out = mapRow(FULL as any);
    expect(out.cancelledInFlight).toBe(false);
    expect(out.closed).toBe(false);
  });

  it("draws its own branch, above damaged", () => {
    const page = readFileSync("src/routes/+page.svelte", "utf8");
    const ret = page.indexOf("{:else if returned}");
    const dam = page.indexOf("{:else if damaged && replacedBy}");
    expect(ret).toBeGreaterThan(-1);
    expect(dam).toBeGreaterThan(ret);
    expect(page).toMatch(/The courier couldn't deliver it/);
  });

  it("names the Dropy India warehouse rather than claiming it", () => {
    const page = readFileSync("src/routes/+page.svelte", "utf8");
    expect(page).not.toMatch(/our Mumbai\s*\n?\s*warehouse/);
  });
});

describe("the bridge route", () => {
  const SRC = readFileSync(
    "src/routes/api/admin/orders/from-order-central/returned/+server.ts", "utf8");

  it("is behind the bridge secret, like every Order Central route", () => {
    expect(SRC).toMatch(/checkBridgeSecret/);
    expect(SRC).toMatch(/status: 401/);
  });

  it("only acts on a parcel a courier actually had", () => {
    /* An order that never reached a courier cannot be returned by one,
       and accepting it would invent a delivery attempt. */
    expect(SRC).toMatch(/order\.current_stage !== "handed_to_courier"/);
    expect(SRC).toMatch(/changed: false/);
  });

  it("is idempotent — a courier sends three RTO events, not one", () => {
    /* RTO_INITIATED, RTO_IN_TRANSIT, RTO_DELIVERED. The second and third
       must not restamp held_at or write the trail twice. */
    expect(SRC).toMatch(/order\.current_stage === "returned"/);
  });

  it("stamps held_at, which is what makes the hold answerable later", () => {
    expect(SRC).toMatch(/held_at: ts/);
  });

  it("leaves picked_up_at set — the courier really did collect it", () => {
    /* Clearing it would send realEventStage back to the clock on a
       parcel demonstrably past the warehouse. */
    expect(SRC).not.toMatch(/picked_up_at: null/);
    expect(SRC).toMatch(/picked_up_at is deliberately LEFT SET/);
  });

  it("writes the CUSTOMER trail, not only the audit log", () => {
    expect(SRC).toMatch(/recordHoldEvent\(supabase, order\.id, STAGE/);
    expect(SRC).toMatch(/logSystemAudit/);
  });

  it("does not wind the progress bar backwards", () => {
    expect(SRC).toMatch(/STAGE_PROGRESS\.handed_to_courier/);
  });
});
