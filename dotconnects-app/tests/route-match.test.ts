import { describe, it, expect } from "vitest";
import { ACTIVE_ROUTES } from "../src/lib/order-routes";
import { routesForDays, pickRouteForDays } from "../src/lib/route-match";
import { calendarDays } from "../src/lib/dates";

describe("routesForDays", () => {
  it("returns only routes of exactly that length when they exist", () => {
    for (const d of [12, 15, 18, 25]) {
      const pool = routesForDays(ACTIVE_ROUTES, d);
      expect(pool.length).toBeGreaterThan(0);
      expect(pool.every((r) => r.transitDays === d)).toBe(true);
    }
  });

  it("keeps more than one shape per length, so timelines still differ", () => {
    expect(routesForDays(ACTIVE_ROUTES, 15).length).toBeGreaterThan(1);
  });

  it("falls back to the nearest length instead of returning nothing", () => {
    const below = routesForDays(ACTIVE_ROUTES, 3);
    const above = routesForDays(ACTIVE_ROUTES, 40);
    expect(below.every((r) => r.transitDays === 12)).toBe(true);
    expect(above.every((r) => r.transitDays === 25)).toBe(true);
  });

  it("never returns an empty pool for any window DOC can send", () => {
    for (let working = 1; working <= 30; working++) {
      expect(routesForDays(ACTIVE_ROUTES, calendarDays(working)).length).toBeGreaterThan(0);
    }
  });
});

describe("pickRouteForDays", () => {
  it("matches the window a 12-working-day order is actually sold on", () => {
    const route = pickRouteForDays(ACTIVE_ROUTES, calendarDays(12), 4251);
    expect(calendarDays(12)).toBe(15);
    expect(route.transitDays).toBe(15);
  });

  it("gives the same order the same journey every time", () => {
    const a = pickRouteForDays(ACTIVE_ROUTES, 15, 987654);
    const b = pickRouteForDays(ACTIVE_ROUTES, 15, 987654);
    expect(a.key).toBe(b.key);
  });

  it("spreads different orders across the shapes available", () => {
    const keys = new Set(
      Array.from({ length: 200 }, (_, i) => pickRouteForDays(ACTIVE_ROUTES, 15, i * 7919 + 3).key),
    );
    expect(keys.size).toBeGreaterThan(1);
  });

  it("only ever returns a US route", () => {
    for (let i = 0; i < 50; i++) {
      expect(pickRouteForDays(ACTIVE_ROUTES, 15, i).key.startsWith("US")).toBe(true);
    }
  });

  it("throws rather than assigning nothing", () => {
    expect(() => pickRouteForDays([], 15, 1)).toThrow(/no routes/i);
  });
});
