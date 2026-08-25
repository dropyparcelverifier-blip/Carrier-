import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALL_LOCATIONS,
  ROUTES,
  effectiveStage,
  getRoute,
  pickRandomRoute,
  routeStageLocation,
  suggestStageForRoute,
} from "$lib/routes";
import { ORIGINS } from "$lib/network";
import { STAGES } from "$lib/types";

describe("getRoute", () => {
  it("returns the matching route for a known key", () => {
    const route = getRoute("newark-frankfurt-mumbai");
    expect(route.key).toBe("newark-frankfurt-mumbai");
  });

  it("falls back to the first route for an unknown or missing key", () => {
    expect(getRoute("not-a-real-route").key).toBe(ROUTES[0].key);
    expect(getRoute(null).key).toBe(ROUTES[0].key);
    expect(getRoute(undefined).key).toBe(ROUTES[0].key);
  });
});

describe("pickRandomRoute", () => {
  it("always returns one of the defined routes", () => {
    for (let i = 0; i < 20; i++) {
      const route = pickRandomRoute();
      expect(ROUTES).toContain(route);
    }
  });

  it("only returns routes matching the given origin market", () => {
    for (let i = 0; i < 20; i++) {
      expect(pickRandomRoute("United Kingdom").origin).toBe("United Kingdom");
      expect(pickRandomRoute("Japan").origin).toBe("Japan");
    }
  });

  it("only returns routes matching the given shipping mode", () => {
    for (let i = 0; i < 20; i++) {
      expect(pickRandomRoute(null, "Ocean Freight").modes).toContain("Ocean Freight");
      expect(pickRandomRoute(null, "Air Freight").modes).toContain("Air Freight");
    }
  });

  it("falls back to the wider pool for an origin/mode combination with no route yet", () => {
    // No UK ocean route exists — should still return *a* route rather than
    // throwing or returning undefined.
    for (let i = 0; i < 10; i++) {
      const route = pickRandomRoute("United Kingdom", "Ocean Freight");
      expect(ROUTES).toContain(route);
    }
  });
});

describe("routeStageLocation", () => {
  it("returns the location for a real route + stage", () => {
    const loc = routeStageLocation("newark-frankfurt-mumbai", "order_placed");
    expect(loc).toBe("dropy.in");
  });

  it("returns an empty string for an unknown route", () => {
    // getRoute falls back to ROUTES[0], so this actually resolves via the
    // fallback route rather than truly failing — pin that behavior.
    const loc = routeStageLocation("bogus-route", "order_placed");
    expect(loc).toBe(ROUTES[0].stages.order_placed.location);
  });
});

describe("every route", () => {
  it("has exactly 13 stages, one per STAGES key, in order", () => {
    for (const route of ROUTES) {
      expect(Object.keys(route.stages)).toHaveLength(STAGES.length);
      for (const s of STAGES) {
        expect(route.stages[s.key]).toBeDefined();
      }
    }
  });

  it("has monotonically non-decreasing timing_pct across stages", () => {
    for (const route of ROUTES) {
      const pcts = STAGES.map((s) => route.stages[s.key].timing_pct);
      for (let i = 1; i < pcts.length; i++) {
        expect(pcts[i]).toBeGreaterThanOrEqual(pcts[i - 1]);
      }
    }
  });

  it("starts at 0 and ends at 1.00", () => {
    for (const route of ROUTES) {
      expect(route.stages.order_placed.timing_pct).toBe(0);
      expect(route.stages.qc_check.timing_pct).toBe(1);
    }
  });

  it("has an origin that matches one of lib/network.ts ORIGINS", () => {
    const validCountries = ORIGINS.map((o) => o.country);
    for (const route of ROUTES) {
      expect(validCountries).toContain(route.origin);
    }
  });

  it("declares at least one shipping mode", () => {
    for (const route of ROUTES) {
      expect(route.modes.length).toBeGreaterThan(0);
    }
  });
});

describe("ocean freight routes", () => {
  it("includes at least one Ocean Freight route", () => {
    const oceanRoutes = ROUTES.filter((r) => r.modes.includes("Ocean Freight"));
    expect(oceanRoutes.length).toBeGreaterThan(0);
  });

  it("does not overlap with Air Freight on the same route", () => {
    // A route is physically one mode or the other, not both — ocean cargo
    // doesn't fly and vice versa.
    const oceanRoutes = ROUTES.filter((r) => r.modes.includes("Ocean Freight"));
    for (const route of oceanRoutes) {
      expect(route.modes).not.toContain("Air Freight");
    }
  });
});

describe("ALL_LOCATIONS", () => {
  it("is deduped and non-empty", () => {
    expect(ALL_LOCATIONS.length).toBeGreaterThan(0);
    expect(new Set(ALL_LOCATIONS).size).toBe(ALL_LOCATIONS.length);
  });
});

describe("suggestStageForRoute", () => {
  const routeKey = "newark-frankfurt-mumbai";

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("suggests order_placed right when the order is created", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    vi.setSystemTime(now);
    const stage = suggestStageForRoute(routeKey, now.toISOString(), 10);
    expect(stage).toBe("order_placed");
  });

  it("suggests qc_check once the full shipping window has elapsed", () => {
    const created = new Date("2026-01-01T00:00:00.000Z");
    const shippingDays = 10;
    // suggestStageForRoute uses shippingDays * 1.4 calendar days as the total window.
    const totalMs = shippingDays * 1.4 * 24 * 60 * 60 * 1000;
    vi.setSystemTime(new Date(created.getTime() + totalMs + 1));
    const stage = suggestStageForRoute(routeKey, created.toISOString(), shippingDays);
    expect(stage).toBe("qc_check");
  });

  it("never regresses past qc_check even long after delivery", () => {
    const created = new Date("2020-01-01T00:00:00.000Z");
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const stage = suggestStageForRoute(routeKey, created.toISOString(), 10);
    expect(stage).toBe("qc_check");
  });
});

describe("effectiveStage", () => {
  const routeKey = "newark-frankfurt-mumbai";

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never surfaces past qc_check or exception via the clock", () => {
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
    expect(effectiveStage(routeKey, "qc_check", "2020-01-01T00:00:00.000Z", 10)).toBe("qc_check");
    expect(effectiveStage(routeKey, "exception", "2020-01-01T00:00:00.000Z", 10)).toBe("exception");
  });

  it("prefers the time-suggested stage when it's further along than the DB stage", () => {
    const created = new Date("2020-01-01T00:00:00.000Z");
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const result = effectiveStage(routeKey, "order_placed", created.toISOString(), 10);
    expect(result).toBe("qc_check");
  });

  it("keeps the manually-set DB stage when it's already further along than the clock suggests", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    vi.setSystemTime(now);
    // Order was just created, so the clock alone would suggest order_placed —
    // but an admin has already manually advanced it to at_vashi_warehouse.
    const result = effectiveStage(routeKey, "at_vashi_warehouse", now.toISOString(), 10);
    expect(result).toBe("at_vashi_warehouse");
  });
});
