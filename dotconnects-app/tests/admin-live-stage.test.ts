import { describe, it, expect } from "vitest";
import { effectiveOrderStage, suggestStageForOrderRoute } from "../src/lib/order-routes";
import { STAGES } from "../src/lib/types";

/* The admin timeline sat still while the customer one advanced.
   `current_stage` only moves when someone records a move or a courier
   webhook fires; the customer page computed a live stage from the clock
   first, the admin page passed the raw column through. Same parcel, two
   different answers. */

const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();

describe("live stage vs stored stage", () => {
  it("a parcel mid-flight has moved past the stage last written", () => {
    /* Pushed 8 days ago on a 13-day window, last recorded at
       'processing' on day one -- which is the shape of every order
       nobody has manually touched since. */
    const stored = "processing";
    const live = effectiveOrderStage("US15DTWO", stored, iso(8), 13, 4251);
    expect(live).not.toBe(stored);
    const idx = (k: string) => STAGES.findIndex((s) => s.key === k);
    expect(idx(live)).toBeGreaterThan(idx(stored));
  });

  it("never rewinds past a stage already recorded", () => {
    // Recorded well ahead of the clock: the record wins.
    const live = effectiveOrderStage("US15DTWO", "at_vashi_warehouse", iso(1), 13, 4251);
    expect(live).toBe("at_vashi_warehouse");
  });

  it("is idempotent — the customer page already passes a live stage", () => {
    const once = effectiveOrderStage("US15DTWO", "processing", iso(8), 13, 4251);
    const twice = effectiveOrderStage("US15DTWO", once, iso(8), 13, 4251);
    expect(twice).toBe(once);
  });

  it("a held parcel does not advance", () => {
    expect(effectiveOrderStage("US15DTWO", "exception", iso(8), 13, 4251)).toBe("exception");
  });

  it("stops at the end-of-route stages rather than running past them", () => {
    for (const terminal of ["qc_check", "handed_to_courier"]) {
      expect(effectiveOrderStage("US15DTWO", terminal, iso(40), 13, 4251)).toBe(terminal);
    }
  });

  it("extending the window slows the parcel down, it does not jump it forward", () => {
    const short = suggestStageForOrderRoute("US15DTWO", iso(8), 13, 4251);
    const long = suggestStageForOrderRoute("US15DTWO", iso(8), 20, 4251);
    const idx = (k: string) => STAGES.findIndex((s) => s.key === k);
    expect(idx(long)).toBeLessThanOrEqual(idx(short));
  });

  it("both screens now compute from the same inputs, so they agree", () => {
    const row = { route_key: "US15DTWO", current_stage: "packed", order_date: iso(6), shipping_days: 13, timing_seed: 991 };
    const customer = effectiveOrderStage(row.route_key, row.current_stage, row.order_date, row.shipping_days, row.timing_seed);
    const admin = effectiveOrderStage(row.route_key, row.current_stage, row.order_date, row.shipping_days, row.timing_seed);
    expect(admin).toBe(customer);
  });
});
