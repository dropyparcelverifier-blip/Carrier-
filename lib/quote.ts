import { ORIGINS, type Origin } from "./network";

/**
 * A rule-based estimate, not a live carrier quote. There is no real rate
 * data wired into this project — the transit windows in lib/network.ts are
 * already marked PLACEHOLDER for the same reason, and this reuses them
 * rather than inventing a second, disconnected set of numbers. Every
 * consumer of this module must present its output as indicative, never as
 * a number a customer could hold the business to.
 */

export type ProductCategory =
  | "cosmetics"
  | "skincare"
  | "fragrance"
  | "supplements"
  | "electronics"
  | "pets"
  | "apparel"
  | "general";

export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "cosmetics", label: "Colour cosmetics" },
  { value: "skincare", label: "Skincare & haircare" },
  { value: "fragrance", label: "Fragrance & luxury" },
  { value: "supplements", label: "Supplements & wellness" },
  { value: "electronics", label: "Electronics & accessories" },
  { value: "pets", label: "Pet supplies" },
  { value: "apparel", label: "Apparel & footwear" },
  { value: "general", label: "General cargo" },
];

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
const RATE_PER_KG: Record<ProductCategory, number> = {
  cosmetics: 650,
  skincare: 600,
  fragrance: 800,
  supplements: 530,
  electronics: 700,
  pets: 680,
  apparel: 480,
  general: 450,
};

const BASE_HANDLING_INR = 2900;
const MIN_CHARGEABLE_KG = 1;

export type QuoteEstimate = {
  origin: Origin;
  weightKg: number;
  chargeableKg: number;
  category: ProductCategory;
  freightInr: number;
  handlingInr: number;
  totalInr: number;
  transitLabel: string;
};

export function estimateQuote(
  originCountry: string,
  weightKg: number,
  category: ProductCategory,
): QuoteEstimate | null {
  const origin = ORIGINS.find((o) => o.country === originCountry);
  if (!origin) return null;

  const chargeableKg = Math.max(weightKg, MIN_CHARGEABLE_KG);
  const freightInr = chargeableKg * RATE_PER_KG[category];
  const totalInr = freightInr + BASE_HANDLING_INR;

  return {
    origin,
    weightKg,
    chargeableKg,
    category,
    freightInr,
    handlingInr: BASE_HANDLING_INR,
    totalInr,
    transitLabel: origin.transit,
  };
}
