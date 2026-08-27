import { ORIGINS, type Origin } from "./network";

/**
 * A rule-based estimate, not a live carrier quote. There is no real rate
 * data wired into this project — the transit windows in lib/network.ts are
 * already marked PLACEHOLDER for the same reason, and this reuses them
 * rather than inventing a second, disconnected set of numbers. Every
 * consumer of this module must present its output as indicative, never as
 * a number a customer could hold the business to.
 */

/**
 * INR per kg, air freight, before the base handling fee. DotConnects Logistics invoices
 * Indian customers in Rupees for its own freight/handling service — this
 * is distinct from a shipment's declared customs value (lib/types.ts
 * `declaredValueUsd`), which legitimately stays in USD since that's the
 * currency the underlying goods were purchased in from a US seller.
 * Fragrance carries a dangerous-goods surcharge built in; electronics and
 * pet supplies carry extra handling/certification cost (batteries, animal
 * product import rules respectively); supplements, apparel and general
 * cargo are cheaper to move since they need no special certification.
 */
/**
 * Air freight rate, INR per chargeable kilo.
 *
 * Was a rate PER PRODUCT CATEGORY — cosmetics 650, fragrance 800, apparel
 * 480 and so on. Category is gone from the form, so this is the single
 * general-cargo rate that was already the baseline (450).
 *
 * ⚠️  CONFIRM THIS WITH THE CARGO before the site goes live. It was
 *     invented alongside the eleven fabricated statistics and has never
 *     been checked against a real invoice.
 */
const RATE_PER_KG = 450;

/**
 * Fixed per-consignment cost: documentation, customs filing, handling and
 * reinforced packing. Charged once regardless of weight, which is why a
 * 5 kg consignment isn't a fifth the price of a 25 kg one.
 *
 * ⚠️  Also needs confirming.
 */
const BASE_HANDLING_INR = 2900;

/**
 * Minimum chargeable weight.
 *
 * Was 1 kg, which priced a single carton at ₹3,350 — below what the
 * documentation and customs filing alone cost to produce. Air freight is
 * quoted against a minimum for exactly this reason.
 *
 * This does NOT contradict "one carton minimum" on the homepage: we
 * accept one carton, it's just billed at the 5 kg floor.
 */
export const MIN_CHARGEABLE_KG = 5;

/**
 * Volumetric divisor, IATA standard for air freight.
 *
 * A box of pillows weighs little and fills a pallet; a box of ball
 * bearings is the reverse. Airlines charge on whichever is greater, so a
 * quote that ignores volume under-prices light bulky cargo — the exact
 * case a freight buyer will test you on.
 */
const VOLUMETRIC_DIVISOR = 5000;

export type QuoteEstimate = {
  origin: Origin;
  weightKg: number;
  volumetricKg: number | null;
  chargeableKg: number;
  /** Which rule set the chargeable weight — shown in the breakdown. */
  chargeableBasis: "actual" | "volumetric" | "minimum";
  freightInr: number;
  handlingInr: number;
  totalInr: number;
  transitLabel: string;
};

/** L x W x H in centimetres, divided by the IATA divisor. */
export function volumetricWeight(l: number, w: number, h: number): number {
  if (!l || !w || !h) return 0;
  return (l * w * h) / VOLUMETRIC_DIVISOR;
}

export function estimateQuote(
  originCountry: string,
  weightKg: number,
  dims?: { l: number; w: number; h: number },
): QuoteEstimate | null {
  const origin = ORIGINS.find((o) => o.country === originCountry);
  if (!origin) return null;

  const volumetricKg = dims ? volumetricWeight(dims.l, dims.w, dims.h) : null;

  // Whichever is greatest: actual, volumetric, or the floor.
  const candidates: [number, QuoteEstimate["chargeableBasis"]][] = [
    [weightKg, "actual"],
    [MIN_CHARGEABLE_KG, "minimum"],
  ];
  if (volumetricKg) candidates.push([volumetricKg, "volumetric"]);
  candidates.sort((a, b) => b[0] - a[0]);

  const [chargeableRaw, chargeableBasis] = candidates[0];
  // Airlines round up to the next half kilo.
  const chargeableKg = Math.ceil(chargeableRaw * 2) / 2;

  const freightInr = Math.round(chargeableKg * RATE_PER_KG);
  const totalInr = freightInr + BASE_HANDLING_INR;

  return {
    origin,
    weightKg,
    volumetricKg,
    chargeableKg,
    chargeableBasis,
    freightInr,
    handlingInr: BASE_HANDLING_INR,
    totalInr,
    transitLabel: origin.transit,
  };
}
