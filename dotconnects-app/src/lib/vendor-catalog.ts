import { PRODUCT_CATEGORIES, type ProductCategory } from "./quote";

/**
 * Real orders ship from a genuine US vendor first (where the goods are
 * actually bought/sourced), get consolidated at a DotConnects Logistics pickup
 * warehouse, then move on the fixed Newark/JFK -> Mumbai Air India Cargo
 * leg (see lib/order-routes.ts — that leg never varies, it's the only
 * genuine non-stop routing). This module covers the part that DOES vary:
 * which vendor, which pickup warehouse, and which domestic carrier moves
 * the goods from vendor to warehouse — realistically different depending
 * on what's being shipped (a supplement vendor doesn't ship from the same
 * warehouse as an electronics vendor).
 *
 * Real order items (AdminOrderItem) carry no category field of their own —
 * only the marketing /quote estimator's items do (lib/quote.ts). Rather
 * than add a schema field, `inferCategory` guesses from the item's free-text
 * name using the same keyword vocabulary a customer service rep would
 * recognise, then `pickVendorProfile` picks ONE profile for the whole order
 * by total weight per category — a mixed cart (skincare + electronics)
 * realistically gets consolidated through whichever vendor/category
 * dominates the shipment by weight, not the first item typed into the form.
 */

export type VendorProfile = {
  category: ProductCategory;
  /** Realistic vendor/supplier names a customer could plausibly have ordered from. */
  vendors: string[];
  warehouseCity: string;
  warehouseState: string;
  /**
   * Domestic first-mile carrier: vendor's dock -> DotConnects Logistics pickup
   * warehouse. Distinct from the Newark/JFK -> Mumbai leg, which is always
   * Air India Cargo (see lib/order-routes.ts) — these are real US domestic/
   * parcel carriers already used elsewhere on the site for exactly this
   * kind of leg (lib/network.ts CARRIERS, "International air" entries whose
   * notes already describe pickup/consolidation work).
   */
  pickupCarrier: string;
};

export const VENDOR_PROFILES: Record<ProductCategory, VendorProfile> = {
  cosmetics: {
    category: "cosmetics",
    vendors: ["Ulta Beauty Fulfillment", "Sephora USA DC", "e.l.f. Cosmetics Direct"],
    warehouseCity: "Newark",
    warehouseState: "NJ",
    pickupCarrier: "UPS",
  },
  skincare: {
    category: "skincare",
    vendors: ["CeraVe / L'Oreal USA Distribution", "Neutrogena Consumer Fulfillment", "The Ordinary (DECIEM) US DC"],
    warehouseCity: "Newark",
    warehouseState: "NJ",
    pickupCarrier: "FedEx",
  },
  fragrance: {
    category: "fragrance",
    vendors: ["FragranceNet.com", "Macy's Fragrance Fulfillment", "Bath & Body Works DC"],
    warehouseCity: "New York",
    warehouseState: "NY",
    pickupCarrier: "UPS",
  },
  supplements: {
    category: "supplements",
    vendors: ["iHerb Fulfillment", "Vitacost Distribution", "GNC Direct"],
    warehouseCity: "New York",
    warehouseState: "NY",
    pickupCarrier: "FedEx",
  },
  electronics: {
    category: "electronics",
    vendors: ["Amazon US Fulfillment", "Best Buy Direct Ship", "B&H Photo Warehouse"],
    warehouseCity: "Newark",
    warehouseState: "NJ",
    pickupCarrier: "DHL Express",
  },
  pets: {
    category: "pets",
    vendors: ["Chewy Fulfillment", "Petco Direct", "PetSmart Distribution"],
    warehouseCity: "New York",
    warehouseState: "NY",
    pickupCarrier: "UPS",
  },
  apparel: {
    category: "apparel",
    vendors: ["Nordstrom Fulfillment", "Nike Direct Distribution", "Gap Inc. DC"],
    warehouseCity: "Newark",
    warehouseState: "NJ",
    pickupCarrier: "FedEx",
  },
  general: {
    category: "general",
    vendors: ["Amazon US Fulfillment", "Walmart Direct Ship", "Target Fulfillment"],
    warehouseCity: "New York",
    warehouseState: "NY",
    pickupCarrier: "UPS",
  },
};

/**
 * Ordered most-specific-first — "sunscreen" must resolve to skincare before
 * the looser "supplement" pass would ever run, etc. Falls through to
 * "general" for anything unrecognised rather than guessing wrong.
 */
const KEYWORD_RULES: [RegExp, ProductCategory][] = [
  [/sunscreen|spf|moistur|cerave|neutrogena|serum|cleanser|toner|retinol|the ordinary|niacinamide/i, "skincare"],
  [/perfume|cologne|fragrance|eau de|\bmist\b|candle/i, "fragrance"],
  [/lipstick|foundation|mascara|eyeshadow|concealer|blush|cosmetic|makeup/i, "cosmetics"],
  [/vitamin|supplement|protein|omega|probiotic|collagen|gummies/i, "supplements"],
  [/earbuds|charger|powercore|battery pack|headphone|electronics|cable|adapter|speaker|watch\b/i, "electronics"],
  [/dog|cat|pet\b|kibble|leash|chew toy/i, "pets"],
  [/shirt|jeans|jacket|shoes|sneaker|dress|apparel|hoodie/i, "apparel"],
];

const VALID_CATEGORIES = new Set(PRODUCT_CATEGORIES.map((c) => c.value));

/** True only for a value that's actually one of the 8 real ProductCategory keys. */
function isProductCategory(value: unknown): value is ProductCategory {
  return typeof value === "string" && VALID_CATEGORIES.has(value as ProductCategory);
}

export function inferCategory(itemName: string): ProductCategory {
  for (const [pattern, category] of KEYWORD_RULES) {
    if (pattern.test(itemName)) return category;
  }
  return "general";
}

export type CategorizedItem = {
  name: string;
  qty: number;
  weight_g: number;
  /**
   * Order Central (the real US-side order system) knows the actual product
   * category it's shipping — when it sends one explicitly, that's used
   * as-is instead of guessing from the item's free-text name. The admin
   * panel's own "New Order" form has no category field, so items created
   * there always fall through to inferCategory() instead.
   *
   * Typed as a plain string, not ProductCategory, because this value
   * crosses a trust boundary (the bridge API's request body / a stored DB
   * row) — isProductCategory() validates it at the one place it's actually
   * consumed (pickVendorProfile) rather than trusting the type system to
   * have validated an external caller's JSON for us.
   */
  category?: string;
};

/**
 * Picks one VendorProfile for the whole order — the category with the
 * greatest total weight wins, so a cart mostly full of skincare with one
 * bonus electronics accessory still consolidates through the skincare
 * vendor/warehouse, matching how a real 3PL would batch it. Per item, an
 * explicit `category` (from Order Central) always wins over the name-based
 * guess (see CategorizedItem).
 */
export function pickVendorProfile(items: CategorizedItem[]): VendorProfile {
  const weightByCategory = new Map<ProductCategory, number>();
  for (const item of items) {
    const category = isProductCategory(item.category) ? item.category : inferCategory(item.name);
    const weight = (item.weight_g || 0) * (item.qty || 1);
    weightByCategory.set(category, (weightByCategory.get(category) ?? 0) + weight);
  }

  let winner: ProductCategory = "general";
  let winnerWeight = -1;
  for (const [category, weight] of weightByCategory) {
    if (weight > winnerWeight) {
      winner = category;
      winnerWeight = weight;
    }
  }

  return VENDOR_PROFILES[winner];
}

/**
 * Deterministic vendor pick within the winning category — same hash
 * approach as lib/order-routes.ts's jitterTimingPct, so the same order
 * (same timing_seed) always names the same vendor rather than a random one
 * on every render.
 */
export function pickVendorName(profile: VendorProfile, seed: number): string {
  const h = Math.sin(seed * 12.9898) * 43758.5453;
  const unit = h - Math.floor(h);
  const idx = Math.floor(unit * profile.vendors.length);
  return profile.vendors[Math.min(idx, profile.vendors.length - 1)];
}

export type ResolvedVendor = { profile: VendorProfile; name: string };

/**
 * One-call resolver for callers that just have the row's items + timing_seed
 * (every admin/bridge route that already loaded the order) — fully
 * deterministic from those two immutable-after-creation inputs, so it's
 * never persisted as its own DB column; recomputing it here always agrees
 * with what was shown at creation time.
 */
export function resolveVendor(
  items: CategorizedItem[],
  timingSeed: number,
): ResolvedVendor {
  const profile = pickVendorProfile(items);
  return { profile, name: pickVendorName(profile, timingSeed) };
}
