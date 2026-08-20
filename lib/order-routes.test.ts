import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STAGES } from "./types";
import {
  ORDER_ROUTES,
  effectiveOrderStage,
  getOrderRoute,
  jitterTimingPct,
  orderRouteStageCarrier,
  orderRouteStageLocation,
  pickOrderRoute,
  randomTimingSeed,
  suggestStageForOrderRoute,
} from "./order-routes";
import { resolveVendor } from "./vendor-catalog";

describe("ORDER_ROUTES", () => {
  it("has exactly two routes — Newark and JFK, both direct to Mumbai", () => {
    expect(ORDER_ROUTES).toHaveLength(2);
    expect(ORDER_ROUTES.map((r) => r.key).sort()).toEqual(["newark-mumbai-direct", "newyork-mumbai-direct"]);
  });

  it("every route is US-origin and carries a real airport code", () => {
    for (const route of ORDER_ROUTES) {
      expect(["EWR", "JFK"]).toContain(route.airportCode);
      expect(route.carrier).toBe("Air India Cargo");
    }
  });

  it("has exactly 13 stages, one per STAGES key, in order", () => {
    for (const route of ORDER_ROUTES) {
      expect(Object.keys(route.stages)).toHaveLength(STAGES.length);
      for (const s of STAGES) {
        expect(route.stages[s.key]).toBeDefined();
      }
    }
  });

  it("has monotonically non-decreasing timing_pct across stages", () => {
    for (const route of ORDER_ROUTES) {
      const pcts = STAGES.map((s) => route.stages[s.key].timing_pct);
      for (let i = 1; i < pcts.length; i++) {
        expect(pcts[i]).toBeGreaterThanOrEqual(pcts[i - 1]);
      }
    }
  });

  it("starts at 0 and ends at 1.00", () => {
    for (const route of ORDER_ROUTES) {
      expect(route.stages.order_placed.timing_pct).toBe(0);
      expect(route.stages.qc_check.timing_pct).toBe(1);
    }
  });

  it("every clock-driven stage-to-stage gap clears 24 hours at the 10-day shipping default", () => {
    // Regression test: earlier drafts of this schedule had gaps as short as
    // ~10h at the 10-day default, which reads as two stages flipping back
    // to back rather than a shipment actually moving. handed_to_courier is
    // exempt — it deliberately shares qc_check's 1.00 ceiling (see STAGES's
    // own note) because it's a real handover action the clock never
    // suggests on its own (see effectiveOrderStage), not a timed leg.
    const totalHours = 10 * 1.4 * 24;
    for (const route of ORDER_ROUTES) {
      let prevPct = 0;
      for (const s of STAGES) {
        const pct = route.stages[s.key].timing_pct;
        const gapHours = (pct - prevPct) * totalHours;
        if (s.key !== "order_placed" && s.key !== "handed_to_courier") {
          expect(gapHours).toBeGreaterThanOrEqual(24);
        }
        prevPct = pct;
      }
    }
  });

  it("has no transit-hub location text — direct flights only", () => {
    for (const route of ORDER_ROUTES) {
      for (const s of STAGES) {
        expect(route.stages[s.key].location.toLowerCase()).not.toContain("transit hub");
      }
    }
  });
});

describe("pickOrderRoute / getOrderRoute", () => {
  it("pickOrderRoute always returns one of the two real routes", () => {
    for (let i = 0; i < 20; i++) {
      expect(ORDER_ROUTES).toContain(pickOrderRoute());
    }
  });

  it("getOrderRoute falls back to the first route for an unknown key", () => {
    expect(getOrderRoute("not-a-real-route").key).toBe(ORDER_ROUTES[0].key);
    expect(getOrderRoute(null).key).toBe(ORDER_ROUTES[0].key);
  });
});

describe("orderRouteStageLocation", () => {
  it("returns the real location for a known route + stage", () => {
    expect(orderRouteStageLocation("newark-mumbai-direct", "order_placed")).toBe("dotconnectslogistics.in");
  });

  it("falls back to the route's own location when no vendor is given", () => {
    expect(orderRouteStageLocation("newark-mumbai-direct", "packed")).toContain("Newark");
  });

  it("uses the vendor's name/city for the processing stage when a vendor is given", () => {
    const vendor = resolveVendor([{ name: "CeraVe Moisturizer", qty: 1, weight_g: 400 }], 42);
    const loc = orderRouteStageLocation("newark-mumbai-direct", "processing", vendor);
    expect(loc).toBe(`${vendor.name}, ${vendor.profile.warehouseCity}, ${vendor.profile.warehouseState}`);
  });

  it("uses the DotConnects Logistics pickup warehouse (not the vendor name) for packed/dispatched", () => {
    const vendor = resolveVendor([{ name: "Anker PowerCore Charger", qty: 1, weight_g: 400 }], 7);
    const packed = orderRouteStageLocation("newark-mumbai-direct", "packed", vendor);
    expect(packed).toContain("DotConnects Logistics Pickup Warehouse");
    expect(packed).not.toContain(vendor.name);
  });

  it("does not apply the vendor override to stages past dispatch", () => {
    const vendor = resolveVendor([{ name: "Anker PowerCore Charger", qty: 1, weight_g: 400 }], 7);
    const withVendor = orderRouteStageLocation("newark-mumbai-direct", "arrived_india", vendor);
    const withoutVendor = orderRouteStageLocation("newark-mumbai-direct", "arrived_india");
    expect(withVendor).toBe(withoutVendor);
  });
});

describe("orderRouteStageCarrier", () => {
  it("is undefined with no vendor given", () => {
    expect(orderRouteStageCarrier("dispatched")).toBeUndefined();
  });

  it("returns the vendor's pickup carrier only for the dispatched stage", () => {
    const vendor = resolveVendor([{ name: "Anker PowerCore Charger", qty: 1, weight_g: 400 }], 7);
    expect(orderRouteStageCarrier("dispatched", vendor)).toBe(vendor.profile.pickupCarrier);
    expect(orderRouteStageCarrier("processing", vendor)).toBeUndefined();
    expect(orderRouteStageCarrier("packed", vendor)).toBeUndefined();
    expect(orderRouteStageCarrier("at_us_airport", vendor)).toBeUndefined();
  });
});

describe("jitterTimingPct", () => {
  it("is deterministic — same seed and stage always jitter the same way", () => {
    const a = jitterTimingPct(0.5, 1234, 5);
    const b = jitterTimingPct(0.5, 1234, 5);
    expect(a).toBe(b);
  });

  it("different seeds produce different jitter (not a no-op)", () => {
    const a = jitterTimingPct(0.5, 1, 5);
    const b = jitterTimingPct(0.5, 9999, 5);
    expect(a).not.toBe(b);
  });

  it("never jitters the fixed 0% or 100% endpoints", () => {
    expect(jitterTimingPct(0, 42, 0)).toBe(0);
    expect(jitterTimingPct(1, 42, 12)).toBe(1);
  });

  it("stays within a small range of the base value — never closes a 24h-floor gap", () => {
    for (let seed = 1; seed < 50; seed++) {
      const jittered = jitterTimingPct(0.5, seed, 3);
      expect(Math.abs(jittered - 0.5)).toBeLessThanOrEqual(0.02);
    }
  });
});

describe("randomTimingSeed", () => {
  it("returns an integer in [0, 9999]", () => {
    for (let i = 0; i < 20; i++) {
      const seed = randomTimingSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(10000);
    }
  });
});

describe("suggestStageForOrderRoute", () => {
  const routeKey = "newark-mumbai-direct";

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("suggests order_placed right when the order is created", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    vi.setSystemTime(now);
    expect(suggestStageForOrderRoute(routeKey, now.toISOString(), 10)).toBe("order_placed");
  });

  it("suggests qc_check once the full shipping window has elapsed", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    const totalMs = 10 * 1.4 * 24 * 60 * 60 * 1000;
    vi.setSystemTime(new Date(created.getTime() + totalMs + 1));
    expect(suggestStageForOrderRoute(routeKey, created.toISOString(), 10)).toBe("qc_check");
  });

  it("jitter never changes which stage is suggested by more than one step either way", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(new Date(created.getTime() + 5 * 24 * 60 * 60 * 1000));
    const unseeded = suggestStageForOrderRoute(routeKey, created.toISOString(), 10, 0);
    const unseededIdx = STAGES.findIndex((s) => s.key === unseeded);
    for (let seed = 1; seed < 30; seed++) {
      const seeded = suggestStageForOrderRoute(routeKey, created.toISOString(), 10, seed);
      const seededIdx = STAGES.findIndex((s) => s.key === seeded);
      expect(Math.abs(seededIdx - unseededIdx)).toBeLessThanOrEqual(1);
    }
  });
});

describe("effectiveOrderStage", () => {
  const routeKey = "newark-mumbai-direct";

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never auto-advances past qc_check or exception via the clock", () => {
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
    expect(effectiveOrderStage(routeKey, "qc_check", "2020-01-01T00:00:00.000Z", 10)).toBe("qc_check");
    expect(effectiveOrderStage(routeKey, "exception", "2020-01-01T00:00:00.000Z", 10)).toBe("exception");
  });

  it("prefers the time-suggested stage when it's further along than the DB stage", () => {
    const created = new Date("2020-01-01T00:00:00.000Z");
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    expect(effectiveOrderStage(routeKey, "order_placed", created.toISOString(), 10)).toBe("qc_check");
  });

  it("keeps a manually-set DB stage when it's already further along than the clock suggests", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    vi.setSystemTime(now);
    expect(effectiveOrderStage(routeKey, "at_vashi_warehouse", now.toISOString(), 10)).toBe("at_vashi_warehouse");
  });
});
