import { describe, it, expect } from "vitest";
import { toStatusLeg, STATUS_SELECT, type StatusRow } from "../lib/status-payload";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Order date is RELATIVE to now, not a fixed string.
 *
 * A hardcoded date rots: this fixture originally used 2026-08-01 with 12
 * shipping days, which was inside its window when written and silently
 * became overdue once real time moved past the ETA. The test then failed
 * for a reason that had nothing to do with the code.
 */
const RECENT_ORDER_DATE = new Date(Date.now() - 3 * DAY).toISOString();

const base: StatusRow = {
  id: "uuid-1",
  tracking_id: "USLMT6V291D0045868",
  dropy_order_id: "DROPY-3177",
  us_order_id: "114-6167166-0045868",
  current_stage: "mid_transit",
  status: "In Transit",
  progress: 62,
  estimated_delivery: "15 Aug 2026",
  order_date: RECENT_ORDER_DATE,
  shipping_days: 12,
  route_key: null,
  timing_seed: 0,
  clock_anchor_stage: null,
  clock_anchor_at: null,
  label_generated_at: null,
  picked_up_at: null,
  delivered_at: null,
  replacement_of: null,
  last_mile_courier: null,
  last_mile_awb: null,
  last_mile_tracking_url: null,
};

describe("status payload carries no customer PII", () => {
  it("SELECT does not request customer fields", () => {
    // DOC already holds the customer record. Repeating it here would
    // widen the blast radius of a leaked bridge secret for no gain.
    for (const field of [
      "customer_name", "customer_mobile", "customer_email",
      "customer_address", "customer_pincode", "admin_notes",
    ]) {
      expect(STATUS_SELECT).not.toContain(field);
    }
  });

  it("the built payload has no customer keys", () => {
    const leg = toStatusLeg(base);
    const json = JSON.stringify(leg);
    expect(json).not.toContain("customer");
    expect(json).not.toContain("admin_notes");
  });
});

describe("status payload — real events beat the clock", () => {
  it("a generated label puts the order at qc_check", () => {
    const leg = toStatusLeg({ ...base, label_generated_at: "2026-08-08T00:00:00Z" });
    expect(leg.stage).toBe("qc_check");
  });

  it("a pickup puts the order at handed_to_courier", () => {
    const leg = toStatusLeg({
      ...base,
      label_generated_at: "2026-08-08T00:00:00Z",
      picked_up_at: "2026-08-09T00:00:00Z",
    });
    expect(leg.stage).toBe("handed_to_courier");
  });

  it("pickup wins over label — the later real event is the truth", () => {
    const leg = toStatusLeg({
      ...base,
      label_generated_at: "2026-08-08T00:00:00Z",
      picked_up_at: "2026-08-09T00:00:00Z",
    });
    expect(leg.stage).not.toBe("qc_check");
  });

  it("exposes the raw milestone timestamps for DOC to template from", () => {
    const leg = toStatusLeg({ ...base, label_generated_at: "2026-08-08T00:00:00Z" });
    expect(leg.milestones.label_generated_at).toBe("2026-08-08T00:00:00Z");
    expect(leg.milestones.picked_up_at).toBeNull();
  });
});

describe("status payload — hold states are terminal", () => {
  it("a damaged order stays damaged regardless of elapsed time", () => {
    const leg = toStatusLeg({ ...base, current_stage: "damaged" });
    expect(leg.stage).toBe("damaged");
    expect(leg.is_damaged).toBe(true);
    expect(leg.stage_label).toBe("Damaged in transit");
  });

  it("a held order stays held", () => {
    const leg = toStatusLeg({ ...base, current_stage: "exception" });
    expect(leg.stage).toBe("exception");
    expect(leg.stage_label).toBe("On hold");
  });

  it("a damaged order is never reported overdue", () => {
    const leg = toStatusLeg({
      ...base,
      current_stage: "damaged",
      order_date: "2020-01-01T00:00:00.000Z", // long past its window
    });
    expect(leg.is_overdue).toBe(false);
  });
});

describe("status payload — overdue withholds the date", () => {
  // Well past any window, and no real arrival event recorded.
  const overdueRow: StatusRow = { ...base, order_date: "2020-01-01T00:00:00.000Z" };

  it("reports overdue", () => {
    expect(toStatusLeg(overdueRow).is_overdue).toBe(true);
  });

  it("returns null estimated_delivery, not a stale date", () => {
    // DOC must not template a delivery date we have decided not to
    // promise. Sending the old string would put it straight into a
    // WhatsApp message.
    expect(toStatusLeg(overdueRow).estimated_delivery).toBeNull();
  });

  it("keeps the date when not overdue", () => {
    expect(toStatusLeg(base).estimated_delivery).toBe("15 Aug 2026");
  });
});

describe("status payload — replacement flag", () => {
  it("is false for an ordinary order", () => {
    expect(toStatusLeg(base).is_replacement).toBe(false);
  });

  it("is true when replacement_of is set", () => {
    const leg = toStatusLeg({ ...base, replacement_of: "uuid-parent" });
    expect(leg.is_replacement).toBe(true);
  });
});

describe("status payload — anchored orders", () => {
  it("honours a manual anchor rather than the raw clock", () => {
    const leg = toStatusLeg({
      ...base,
      clock_anchor_stage: "arrived_india",
      clock_anchor_at: "2026-08-06T00:00:00.000Z",
    });
    // Must be at or past the anchored stage, never behind it
    const order = [
      "order_placed", "processing", "packed", "dispatched", "at_us_airport",
      "us_customs_cleared", "in_transit_departed", "mid_transit",
      "arrived_india", "indian_customs", "customs_cleared",
      "at_vashi_warehouse", "qc_check",
    ];
    expect(order.indexOf(leg.stage)).toBeGreaterThanOrEqual(order.indexOf("arrived_india"));
  });
});
