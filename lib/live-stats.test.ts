import { describe, expect, it, vi } from "vitest";
import { jitter, jitterPercent } from "./live-stats";

describe("jitter", () => {
  it("stays within ± pct of the base value", () => {
    for (let i = 0; i < 50; i++) {
      const result = jitter(1000, 0.05);
      expect(result).toBeGreaterThanOrEqual(950);
      expect(result).toBeLessThanOrEqual(1050);
    }
  });

  it("returns exactly the base value when pct is 0", () => {
    expect(jitter(500, 0)).toBe(500);
  });

  it("returns the base value at Math.random()'s midpoint (no delta)", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(jitter(200, 0.1)).toBe(200);
    spy.mockRestore();
  });

  it("swings to the minimum at Math.random() = 0", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    expect(jitter(200, 0.1)).toBeCloseTo(180);
    spy.mockRestore();
  });

  it("swings to the maximum at Math.random() = 1", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(1);
    expect(jitter(200, 0.1)).toBeCloseTo(220);
    spy.mockRestore();
  });
});

describe("jitterPercent", () => {
  it("never exceeds 100 even when jitter would push it over", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(1);
    expect(jitterPercent(98, 0.1)).toBe(100);
    spy.mockRestore();
  });

  it("behaves like jitter when comfortably under 100", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(jitterPercent(80, 0.05)).toBe(80);
    spy.mockRestore();
  });
});
