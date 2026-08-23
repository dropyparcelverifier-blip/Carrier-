import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STAGES, type StageKey } from "./types";
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

  it("the two long-haul transit legs each take far longer than a same-day customs/warehouse step at the 10-day (12 calendar day) default", () => {
    // Regression test, updated: a strict "every stage >= 24h" floor left
    // zero slack at the 12-calendar-day default (12 real gaps * 24h =
    // exactly 288h) — no room to give the genuinely long legs more time.
    // So gaps are now hand-allocated by realistic duration (see
    // ORDER_ROUTES's own note) instead of enforcing a uniform floor. What
    // still matters: the long-haul legs (Atlantic/Arabian Sea crossings)
    // must clearly dominate the schedule, not get flattened to the same
    // duration as a same-day customs stamp.
    const totalHours = 10 * 1.2 * 24;
    for (const route of ORDER_ROUTES) {
      const gap = (from: StageKey, to: StageKey) =>
        (route.stages[to].timing_pct - route.stages[from].timing_pct) * totalHours;
      const longHaulHours = gap("us_customs_cleared", "in_transit_departed") + gap("in_transit_departed", "mid_transit");
      const packedHours = gap("processing", "packed");
      const dispatchedHours = gap("packed", "dispatched");
      expect(longHaulHours).toBeGreaterThan(packedHours * 3);
      expect(longHaulHours).toBeGreaterThan(dispatchedHours * 3);
    }
  });

  it("handed_to_courier is exempt from the clock — it's a real handover action, not a timed leg (see effectiveOrderStage)", () => {
    for (const route of ORDER_ROUTES) {
      expect(route.stages.handed_to_courier.timing_pct).toBe(route.stages.qc_check.timing_pct);
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
    expect(orderRouteStageLocation("newark-mumbai-direct", "order_placed")).toBe("dropy.in");
  });

  it("falls back to the route's own location when no vendor is given", () => {
    expect(orderRouteStageLocation("newark-mumbai-direct", "packed")).toContain("Newark");
  });

  it("uses the Dropy Warehouse (not the vendor name) for processing, using the vendor's CITY only", () => {
    // Never the vendor's own name (e.g. "CeraVe / L'Oreal USA
    // Distribution") — reads as an unauthorized brand association. The
    // receiving/QC stage happens at "Dropy Warehouse" specifically (a
    // distinct real facility from "DotConnects Logistics Warehouse",
    // which is where packed/dispatched happen — see
    // lib/order-routes.ts's own note). Only the vendor's warehouse city
    // varies the location, since a real order's product can ship from
    // any of several US vendor cities.
    const vendor = resolveVendor([{ name: "CeraVe Moisturizer", qty: 1, weight_g: 400 }], 42);
    const loc = orderRouteStageLocation("newark-mumbai-direct", "processing", vendor);
    expect(loc).toBe(`Dropy Warehouse, ${vendor.profile.warehouseCity}, ${vendor.profile.warehouseState}`);
    expect(loc).not.toContain(vendor.name);
  });

  it("uses DotConnects Logistics' own warehouse (not the vendor name) for packed/dispatched", () => {
    const vendor = resolveVendor([{ name: "Anker PowerCore Charger", qty: 1, weight_g: 400 }], 7);
    const packed = orderRouteStageLocation("newark-mumbai-direct", "packed", vendor);
    expect(packed).toContain("DotConnects Logistics Warehouse");
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
