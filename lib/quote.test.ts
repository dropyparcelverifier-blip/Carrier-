import { describe, expect, it } from "vitest";
import { estimateQuote, PRODUCT_CATEGORIES } from "./quote";
import { ORIGINS } from "./network";

describe("estimateQuote", () => {
  it("returns null for an origin that isn't in ORIGINS", () => {
    expect(estimateQuote("Atlantis", 5, "skincare")).toBeNull();
  });

  it("computes freight as chargeable weight × the category's per-kg rate", () => {
    const origin = ORIGINS[0].country;
    const estimate = estimateQuote(origin, 10, "skincare");
    expect(estimate).not.toBeNull();
    // skincare rate is 600/kg per lib/quote.ts — pinned here so a silent
    // rate change shows up as a failing test, not just a different number
    // on the page.
    expect(estimate!.freightInr).toBe(6000);
  });

  it("adds the flat handling fee on top of freight for the total", () => {
    const origin = ORIGINS[0].country;
    const estimate = estimateQuote(origin, 10, "skincare");
    expect(estimate!.handlingInr).toBe(2900);
    expect(estimate!.totalInr).toBe(estimate!.freightInr + estimate!.handlingInr);
  });

  it("clamps chargeable weight to the 1kg minimum for lighter shipments", () => {
    const origin = ORIGINS[0].country;
    const heavier = estimateQuote(origin, 0.3, "general")!;
    const atMinimum = estimateQuote(origin, 1, "general")!;
    // 0.3kg should be billed exactly like 1kg, not 0.3kg worth of freight.
    expect(heavier.freightInr).toBe(atMinimum.freightInr);
  });

  it("does not clamp weight above the minimum — freight scales with it", () => {
    const origin = ORIGINS[0].country;
    const at2kg = estimateQuote(origin, 2, "general")!;
    const at4kg = estimateQuote(origin, 4, "general")!;
    expect(at4kg.freightInr).toBe(at2kg.freightInr * 2);
  });

  it("prices fragrance highest and general cargo lowest, per the documented dangerous-goods rule", () => {
    const origin = ORIGINS[0].country;
    const fragrance = estimateQuote(origin, 5, "fragrance")!;
    const general = estimateQuote(origin, 5, "general")!;
    expect(fragrance.freightInr).toBeGreaterThan(general.freightInr);
  });

  it("carries the origin's own transit label through to the estimate", () => {
    const origin = ORIGINS[0];
    const estimate = estimateQuote(origin.country, 5, "skincare")!;
    expect(estimate.transitLabel).toBe(origin.transit);
    expect(estimate.origin).toBe(origin);
  });

  it("every PRODUCT_CATEGORIES value maps to a valid, positive rate", () => {
    const origin = ORIGINS[0].country;
    for (const c of PRODUCT_CATEGORIES) {
      const estimate = estimateQuote(origin, 1, c.value)!;
      expect(estimate.freightInr).toBeGreaterThan(0);
    }
  });
});
