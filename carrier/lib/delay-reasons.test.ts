import { describe, expect, it } from "vitest";
import { DELAY_PROFILES, DELAY_REASONS, delayReasonsForStage, resolveByEstimate } from "./delay-reasons";

describe("DELAY_PROFILES", () => {
  it("has a profile for every DELAY_REASON, with min <= max hours", () => {
    for (const reason of DELAY_REASONS) {
      const profile = DELAY_PROFILES[reason];
      expect(profile).toBeDefined();
      expect(profile.minHours).toBeGreaterThan(0);
      expect(profile.maxHours).toBeGreaterThanOrEqual(profile.minHours);
    }
  });

  it("gives different reasons genuinely different windows, not one-size-fits-all", () => {
    // Regression guard: if every reason ended up with the same min/max,
    // the per-reason modeling would be decorative rather than real.
    const windows = new Set(DELAY_REASONS.map((r) => `${DELAY_PROFILES[r].minHours}-${DELAY_PROFILES[r].maxHours}`));
    expect(windows.size).toBeGreaterThan(1);
  });

  it("Customs hold — documentation runs longer than a plain Customs query", () => {
    expect(DELAY_PROFILES["Customs hold — documentation"].maxHours)
      .toBeGreaterThan(DELAY_PROFILES["Customs query"].maxHours);
  });

  it("Flight cancelled runs at least as long as a plain Flight delayed", () => {
    expect(DELAY_PROFILES["Flight cancelled — rebooked"].minHours)
      .toBeGreaterThanOrEqual(DELAY_PROFILES["Flight delayed"].minHours);
  });
});

describe("delayReasonsForStage", () => {
  it("only offers origin-side reasons while still at the US warehouse", () => {
    const reasons = delayReasonsForStage("packed");
    expect(reasons).toContain("Awaiting carrier pickup");
    expect(reasons).not.toContain("Customs hold — documentation");
    expect(reasons).not.toContain("Address / contact issue");
  });

  it("only offers customs reasons once the shipment has reached Indian customs", () => {
    const reasons = delayReasonsForStage("indian_customs");
    expect(reasons).toContain("Customs query");
    expect(reasons).toContain("Customs hold — documentation");
    expect(reasons).not.toContain("Flight delayed");
    expect(reasons).not.toContain("Awaiting carrier pickup");
  });

  it("only offers flight-related reasons during transit stages", () => {
    const reasons = delayReasonsForStage("mid_transit");
    expect(reasons).toContain("Flight delayed");
    expect(reasons).toContain("Weather delay");
    expect(reasons).not.toContain("Customs query");
  });

  it("always includes Other regardless of stage", () => {
    for (const stage of ["order_placed", "packed", "mid_transit", "indian_customs", "at_vashi_warehouse"] as const) {
      expect(delayReasonsForStage(stage)).toContain("Other");
    }
  });

  it("never returns an empty list for any real stage", () => {
    const stages = ["order_placed", "processing", "packed", "dispatched", "at_us_airport",
      "us_customs_cleared", "in_transit_departed", "mid_transit", "arrived_india",
      "indian_customs", "customs_cleared", "at_vashi_warehouse"] as const;
    for (const stage of stages) {
      expect(delayReasonsForStage(stage).length).toBeGreaterThan(0);
    }
  });
});

describe("resolveByEstimate", () => {
  it("returns a min before max, offset from the given time by the reason's hours", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const { min, max } = resolveByEstimate("Weather delay", from);
    expect(min.getTime()).toBeLessThan(max.getTime());
    expect(min.getTime() - from.getTime()).toBe(6 * 60 * 60 * 1000);
    expect(max.getTime() - from.getTime()).toBe(36 * 60 * 60 * 1000);
  });

  it("defaults to now when no reference time is given", () => {
    const before = Date.now();
    const { min } = resolveByEstimate("Flight delayed");
    const after = Date.now();
    // min should be ~4h after "now", bounded by the test's own execution window.
    expect(min.getTime()).toBeGreaterThanOrEqual(before + 4 * 60 * 60 * 1000);
    expect(min.getTime()).toBeLessThanOrEqual(after + 4 * 60 * 60 * 1000);
  });
});
