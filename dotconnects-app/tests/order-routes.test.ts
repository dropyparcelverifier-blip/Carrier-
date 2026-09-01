import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STAGES, type StageKey } from "$lib/types";
import {
  ACTIVE_ROUTES,
  ORDER_ROUTES,
  effectiveOrderStage,
  getOrderRoute,
  jitterTimingPct,
  orderRouteStageCarrier,
  orderRouteStageLocation,
  pickOrderRoute,
  randomTimingSeed,
  suggestStageForOrderRoute,
} from "$lib/order-routes";
import { resolveVendor } from "$lib/vendor-catalog";

describe("ORDER_ROUTES", () => {
  it("every route key is {days}D{ordinal}, optionally US-prefixed", () => {
    for (const route of ORDER_ROUTES) {
      expect(route.key).toMatch(/^(US)?(1[2-9]|2[0-5])D(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT)$/);
    }
  });

  it("only US routes are active for new orders", () => {
    // An order shipped from a New York warehouse was being assigned
    // Melbourne -> Dubai -> Chennai, because pickOrderRoute() chose at
    // random from every route regardless of origin. Roughly 80% of
    // orders showed a gateway the parcel had never been near.
    expect(ACTIVE_ROUTES.length).toBeGreaterThan(0);
    for (const route of ACTIVE_ROUTES) {
      expect(route.key.startsWith("US")).toBe(true);
    }
  });

  it("the non-US routes are kept, but excluded", () => {
    // Defined so the lanes can be switched on without rebuilding the
    // table — just never assigned to a real order today.
    const inactive = ORDER_ROUTES.filter((r) => !r.key.startsWith("US"));
    expect(inactive.length).toBeGreaterThan(0);
    expect(ORDER_ROUTES.length).toBe(ACTIVE_ROUTES.length + inactive.length);
  });

  it("every active route departs a US gateway", () => {
    const US = ["EWR", "JFK", "ORD", "LAX", "SFO", "IAD", "BOS", "ATL"];
    for (const route of ACTIVE_ROUTES) expect(US).toContain(route.airportCode);
  });

  it("every active route ENDS at the Mumbai warehouse", () => {
    // Entry into India can be Delhi, Bengaluru or Chennai — most of them
    // are — but the consignment always moves domestically to Navi
    // Mumbai. The final three stages must say so.
    for (const route of ACTIVE_ROUTES) {
      for (const stage of ["at_vashi_warehouse", "qc_check", "handed_to_courier"] as const) {
        expect(route.stages[stage].location).toContain("Navi Mumbai");
      }
    }
  });

  it("covers every duration from 12 to 25 days", () => {
    const days = new Set(ACTIVE_ROUTES.map((r) => r.transitDays));
    for (let d = 12; d <= 25; d++) expect(days).toContain(d);
  });

  it("gives twelve days the most variants, and every other length at least three", () => {
    const byDay = new Map<number, number>();
    for (const r of ACTIVE_ROUTES) byDay.set(r.transitDays, (byDay.get(r.transitDays) ?? 0) + 1);
    expect(byDay.get(12)).toBe(8);
    for (const [, n] of byDay) expect(n).toBeGreaterThanOrEqual(3);
  });

  it("route key matches the duration it declares", () => {
    // 15DTWO must be a 15-day route. A mismatch here would quote one
    // window and run a different clock.
    for (const route of ORDER_ROUTES) {
      const declared = Number(route.key.match(/^(?:US)?(\d+)D/)![1]);
      expect(route.transitDays).toBe(declared);
    }
  });

  it("every route carries a real gateway code and a named carrier", () => {
    const GATEWAYS = ["EWR", "JFK", "ORD", "LAX", "SFO", "IAD", "BOS", "ATL",
                      "LHR", "MAN", "ICN", "NRT", "KIX", "SYD", "MEL"];
    for (const route of ORDER_ROUTES) {
      expect(GATEWAYS).toContain(route.airportCode);
      expect(route.carrier.length).toBeGreaterThan(3);
    }
  });

  it("REGRESSION: no route claims a non-stop that doesn't exist", () => {
    // Newark and JFK are the only US cities with a genuine non-stop to
    // Mumbai, both on Air India. An earlier draft of this table had
    // EWR->BLR and JFK->MAA as directs; neither is flown. Anything US
    // origin labelled "(direct)" must therefore go to BOM or DEL.
    for (const route of ORDER_ROUTES) {
      if (!route.label.includes("(direct)")) continue;
      if (["EWR", "JFK", "ORD", "LAX", "SFO", "IAD", "BOS", "ATL"].includes(route.airportCode)) {
        expect(["EWR", "JFK"]).toContain(route.airportCode);
        expect(route.label).toMatch(/-> (BOM|DEL) \(direct\)/);
      }
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
    expect(orderRouteStageLocation("12DONE", "order_placed")).toBe("dotconnectslogistics.com");
  });

  it("falls back to the route's own location when no vendor is given", () => {
    expect(orderRouteStageLocation("12DONE", "packed")).toContain("Newark");
  });

  it("uses our own warehouse name (not the vendor name) for processing, using the vendor's CITY only", () => {
    // Never the vendor's own name (e.g. "CeraVe / L'Oreal USA
    // Distribution") — reads as an unauthorized brand association. The
    // receiving/QC stage happens at "Dropy Warehouse" specifically (a
    // distinct real facility from "DotConnects Logistics Warehouse",
    // which is where packed/dispatched happen — see
    // lib/order-routes.ts's own note). Only the vendor's warehouse city
    // varies the location, since a real order's product can ship from
    // any of several US vendor cities.
    const vendor = resolveVendor([{ name: "CeraVe Moisturizer", qty: 1, weight_g: 400 }], 42);
    const loc = orderRouteStageLocation("12DONE", "processing", vendor);
    expect(loc).toBe(`DotConnects Origin Warehouse, ${vendor.profile.warehouseCity}, ${vendor.profile.warehouseState}`);
    expect(loc).not.toContain(vendor.name);
  });

  it("uses DotConnects Logistics' own warehouse (not the vendor name) for packed/dispatched", () => {
    const vendor = resolveVendor([{ name: "Anker PowerCore Charger", qty: 1, weight_g: 400 }], 7);
    const packed = orderRouteStageLocation("12DONE", "packed", vendor);
    expect(packed).toContain("DotConnects Logistics Warehouse");
    expect(packed).not.toContain(vendor.name);
  });

  it("does not apply the vendor override to stages past dispatch", () => {
    const vendor = resolveVendor([{ name: "Anker PowerCore Charger", qty: 1, weight_g: 400 }], 7);
    const withVendor = orderRouteStageLocation("12DONE", "arrived_india", vendor);
    const withoutVendor = orderRouteStageLocation("12DONE", "arrived_india");
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
  const routeKey = "12DONE";

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
  const routeKey = "12DONE";

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
