import { describe, expect, it } from "vitest";
import { estimateQuote, volumetricWeight, MIN_CHARGEABLE_KG } from "./quote";
import { ORIGINS } from "./network";

/**
 * Rewritten when product category was removed from the quote form.
 *
 * The old suite pinned per-category rates (skincare 600, fragrance 800)
 * and a 1 kg minimum. Both are gone: there's one general-cargo rate now,
 * a 5 kg floor, and volumetric weight.
 */
describe("estimateQuote", () => {
  const origin = ORIGINS[0].country;

  it("returns null for an origin that isn't in ORIGINS", () => {
    expect(estimateQuote("Atlantis", 5)).toBeNull();
  });

  it("computes freight as chargeable weight × the per-kg rate", () => {
    const e = estimateQuote(origin, 10)!;
    // 450/kg per lib/quote.ts — pinned so a silent rate change fails a
    // test rather than quietly repricing the site.
    expect(e.freightInr).toBe(4500);
  });

  it("adds the flat handling fee on top of freight", () => {
    const e = estimateQuote(origin, 10)!;
    expect(e.handlingInr).toBe(2900);
    expect(e.totalInr).toBe(e.freightInr + e.handlingInr);
  });

  it("bills anything under the minimum at the minimum", () => {
    const tiny = estimateQuote(origin, 0.3)!;
    const atFloor = estimateQuote(origin, MIN_CHARGEABLE_KG)!;
    expect(tiny.freightInr).toBe(atFloor.freightInr);
    expect(tiny.chargeableBasis).toBe("minimum");
  });

  it("scales with weight above the minimum", () => {
    const a = estimateQuote(origin, 10)!;
    const b = estimateQuote(origin, 20)!;
    expect(b.freightInr).toBe(a.freightInr * 2);
    expect(a.chargeableBasis).toBe("actual");
  });

  it("charges volumetric weight when the cargo is light and bulky", () => {
    // 60 x 40 x 50 cm = 120,000 cm3 / 5000 = 24 kg volumetric.
    const e = estimateQuote(origin, 6, { l: 60, w: 40, h: 50 })!;
    expect(e.volumetricKg).toBe(24);
    expect(e.chargeableKg).toBe(24);
    expect(e.chargeableBasis).toBe("volumetric");
  });

  it("ignores volumetric weight when actual weight is greater", () => {
    // A dense box: 20 x 20 x 20 = 8000 / 5000 = 1.6 kg volumetric.
    const e = estimateQuote(origin, 30, { l: 20, w: 20, h: 20 })!;
    expect(e.chargeableKg).toBe(30);
    expect(e.chargeableBasis).toBe("actual");
  });

  it("rounds chargeable weight up to the next half kilo", () => {
    // Airlines round up; 10.2 kg bills as 10.5.
    const e = estimateQuote(origin, 10.2)!;
    expect(e.chargeableKg).toBe(10.5);
  });

  it("carries the origin's own transit label through", () => {
    const o = ORIGINS[0];
    const e = estimateQuote(o.country, 10)!;
    expect(e.transitLabel).toBe(o.transit);
    expect(e.origin).toBe(o);
  });
});

describe("volumetricWeight", () => {
  it("divides cubic centimetres by the IATA divisor of 5000", () => {
    expect(volumetricWeight(100, 50, 50)).toBe(50);
  });

  it("returns 0 when any dimension is missing", () => {
    expect(volumetricWeight(0, 50, 50)).toBe(0);
    expect(volumetricWeight(100, 0, 50)).toBe(0);
  });
});
