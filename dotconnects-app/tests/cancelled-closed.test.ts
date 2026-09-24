import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { journeyView } from "$lib/journey";
import { mapRow } from "$lib/server/shipment-service";

/* ═══════════════════════════════════════════════════
   Cancelled AFTER the parcel reached Mumbai.

   A cancelled parcel is CAPPED, not frozen: it keeps travelling and
   stops at the warehouse, and it keeps its arrival date because that
   date is still true.

   But the cap is a ceiling on the CLOCK, not on what happened. Once an
   Indian label has been cut, the box has been handled at Vashi — a
   tracking number is not printed with the parcel over the Arabian Sea.
   Without a floor the page put it wherever the clock had got to, which
   for an order cancelled the same day is mid-Atlantic, and printed a
   warehouse arrival date for a box already sitting in it.
   ═══════════════════════════════════════════════════ */

const ROW = {
  current_stage: "cancelled",
  route_key: null,
  order_date: "2026-09-18T06:00:00.000Z",
  shipping_days: 12,
  timing_seed: 12345,
  held_at: "2026-09-18T12:30:00.000Z",
};

describe("journeyView on a cancelled parcel", () => {
  it("still caps a parcel that is genuinely in the air", () => {
    /* No real event: nothing has been handled in Mumbai, so the clock
       decides and the warehouse is the ceiling. */
    const v = journeyView(ROW, null);
    expect(v.capped).toBe(true);
    expect(v.closed).toBe(false);
  });

  it("floors at the real event once a label has been cut", () => {
    /* THE FIX. qc_check is a real event — the label exists — so the
       journey cannot be reported as somewhere over the Atlantic. */
    const v = journeyView(ROW, "qc_check");
    expect(v.journey).toBe("qc_check");
    expect(v.closed).toBe(true);
  });

  it("is closed at the warehouse too, not only past it", () => {
    const v = journeyView(ROW, "at_vashi_warehouse");
    expect(v.closed).toBe(true);
  });

  it("is closed when the courier had already taken it", () => {
    const v = journeyView(ROW, "handed_to_courier");
    expect(v.journey).toBe("handed_to_courier");
    expect(v.closed).toBe(true);
  });

  it("is NOT closed for a real event short of the warehouse", () => {
    /* Customs cleared is still in transit. The box is coming, and the
       date it lands is a fact worth printing. */
    const v = journeyView(ROW, "customs_cleared");
    expect(v.closed).toBe(false);
  });

  it("leaves every other hold alone", () => {
    for (const stage of ["damaged", "exception", "customs_cleared"]) {
      expect(journeyView({ ...ROW, current_stage: stage }, null).closed).toBe(false);
    }
  });
});

const FULL = {
  id: 9, tracking_id: "RMTMU6XODV49004221", dropy_order_id: "Dropy-5490",
  customer_name: "Box Sensei", customer_mobile: "9876543210",
  customer_city: "Navi Mumbai",
  items: [{ name: "CeraVe Moisturising Cream", qty: 1, weight_kg: 0.52, price_usd: 18 }],
  total_weight_kg: 0.52, total_items: 2, declared_value_usd: 18,
  shipping_days: 12, shipping_mode: "Air Freight",
  route_key: null, timing_seed: 12345, status: "Cancelled", progress: 97,
  estimated_delivery: "03 Oct 2026", carrier_name: "", awb_number: null, admin_notes: null,
  last_mile_courier: null, last_mile_awb: null, last_mile_tracking_url: null,
  last_mile_edd: null, last_mile_original_edd: null,
  order_date: "2026-09-18T06:00:00.000Z",
  clock_anchor_stage: null, clock_anchor_at: null,
  delivered_at: null, dropy_order_events: [],
  current_stage: "cancelled",
  held_at: "2026-09-18T12:30:00.000Z",
  label_generated_at: "2026-09-18T12:28:00.000Z",
  picked_up_at: null,
};

describe("the card when it is closed", () => {
  it("blanks both dates — there is no arrival left to promise", () => {
    const out = mapRow(FULL as any);
    expect(out.closed).toBe(true);
    expect(out.eta).toBe("");
    expect(out.doorstepEta).toBe("");
  });

  it("leads with the cancellation date instead", () => {
    /* An empty headline reads as a page that failed to load. The date it
       was cancelled is a real fact the customer can point at. */
    expect(mapRow(FULL as any).cancelledOn).toBe("18 Sept 2026");
  });

  it("keeps the date on a cancelled parcel still in the air", () => {
    /* Unchanged behaviour: the box really is landing on that date. */
    const flying = { ...FULL, label_generated_at: null, picked_up_at: null };
    const out = mapRow(flying as any);
    expect(out.closed).toBe(false);
    expect(out.eta).toBe("03 Oct 2026");
  });

  it("sets cancelledOn only for a cancelled order", () => {
    const live = { ...FULL, current_stage: "customs_cleared", status: "In Transit" };
    expect(mapRow(live as any).cancelledOn).toBeUndefined();
  });
});

describe("the waypoint line once the parcel is here", () => {
  it("is flagged when a real event put it at the warehouse", () => {
    const at = { ...FULL, current_stage: "qc_check", status: "Received" };
    expect(mapRow(at as any).arrivedAtWarehouse).toBe(true);
  });

  it("is not flagged while it is still travelling", () => {
    const flying = {
      ...FULL, current_stage: "customs_cleared", status: "In Transit",
      label_generated_at: null, picked_up_at: null,
    };
    expect(mapRow(flying as any).arrivedAtWarehouse).toBe(false);
  });
});

describe("the card copy", () => {
  const PAGE = readFileSync("src/routes/+page.svelte", "utf8");

  it("draws the closed branch above the in-flight one", () => {
    const closed = PAGE.indexOf("{#if closed}");
    const flying = PAGE.indexOf("{:else if shipment.cancelledInFlight && etaParts}");
    expect(closed).toBeGreaterThan(-1);
    expect(flying).toBeGreaterThan(closed);
  });

  it("says arrived rather than naming a date that has passed", () => {
    expect(PAGE).toMatch(/Arrived in India\. An Indian courier takes it from here\./);
    // JD, 24 Sept: "Reaching India", never Mumbai, on the customer's page.
    expect(PAGE).not.toMatch(/warehouse in\s+Mumbai/);
    expect(PAGE).toMatch(/\{#if arrived\}/);
  });

  it("never claims the Mumbai warehouse as DotConnects' own", () => {
    /* DotConnects is the forwarder; Dropy India is the consignee it
       delivers TO. "our Mumbai warehouse" collapses two companies into
       one on a page reached from a Dropy order. */
    expect(PAGE).not.toMatch(/our Mumbai\s*\n?\s*warehouse/);
  });

  it("does not offer a refund line on a parcel that already arrived", () => {
    /* That line is for a tracking nothing ever shipped under. */
    expect(PAGE).toMatch(/\{#if !shipment\.cancelledInFlight && !closed\}/);
  });
});
