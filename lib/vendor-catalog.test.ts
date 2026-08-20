import { describe, expect, it } from "vitest";
import { PRODUCT_CATEGORIES } from "./quote";
import {
  VENDOR_PROFILES,
  inferCategory,
  pickVendorName,
  pickVendorProfile,
  resolveVendor,
} from "./vendor-catalog";

describe("VENDOR_PROFILES", () => {
  it("has a profile for every product category, each with a distinct vendor pool", () => {
    for (const { value } of PRODUCT_CATEGORIES) {
      const profile = VENDOR_PROFILES[value];
      expect(profile).toBeDefined();
      expect(profile.vendors.length).toBeGreaterThan(0);
      expect(profile.warehouseCity).toBeTruthy();
      expect(profile.warehouseState).toBeTruthy();
      expect(profile.pickupCarrier).toBeTruthy();
    }
  });

  it("only uses real US pickup carriers already established elsewhere on the site", () => {
    const REAL_CARRIERS = ["DHL Express", "FedEx", "UPS"];
    for (const profile of Object.values(VENDOR_PROFILES)) {
      expect(REAL_CARRIERS).toContain(profile.pickupCarrier);
    }
  });
});

describe("inferCategory", () => {
  it("recognises common skincare product names", () => {
    expect(inferCategory("CeraVe Moisturizing Cream 16oz")).toBe("skincare");
    expect(inferCategory("Neutrogena Ultra Sheer SPF 70")).toBe("skincare");
  });

  it("recognises electronics", () => {
    expect(inferCategory("Anker PowerCore 26800mAh Portable Charger")).toBe("electronics");
    expect(inferCategory("Soundcore Life Q30 Wireless Earbuds")).toBe("electronics");
  });

  it("recognises fragrance", () => {
    expect(inferCategory("BBW Japanese Cherry Blossom Mist")).toBe("fragrance");
  });

  it("falls back to general cargo for an unrecognised name", () => {
    expect(inferCategory("Assorted household item")).toBe("general");
  });
});

describe("pickVendorProfile — explicit category from Order Central", () => {
  it("uses an explicit category instead of guessing from the item name", () => {
    // Name reads as skincare, but Order Central says it's actually general cargo.
    const items = [{ name: "CeraVe-branded travel pouch", qty: 1, weight_g: 100, category: "general" }];
    expect(pickVendorProfile(items).category).toBe("general");
  });

  it("ignores an invalid/unrecognised category string and falls back to inferring from the name", () => {
    const items = [{ name: "Anker PowerCore Charger", qty: 1, weight_g: 400, category: "not-a-real-category" }];
    expect(pickVendorProfile(items).category).toBe("electronics");
  });

  it("mixes explicit and inferred categories correctly across items in the same order", () => {
    // Explicit "electronics" (2000g) outweighs inferred "skincare" (100g).
    const items = [
      { name: "Mystery item", qty: 1, weight_g: 2000, category: "electronics" },
      { name: "CeraVe Moisturizer", qty: 1, weight_g: 100 },
    ];
    expect(pickVendorProfile(items).category).toBe("electronics");
  });
});

describe("pickVendorProfile", () => {
  it("picks the single category's profile for a single-category order", () => {
    const items = [
      { name: "CeraVe Moisturizing Cream", qty: 1, weight_g: 480 },
      { name: "Neutrogena Sunscreen", qty: 2, weight_g: 176 },
    ];
    expect(pickVendorProfile(items).category).toBe("skincare");
  });

  it("picks the category with the greatest total weight for a mixed-category order", () => {
    // Electronics: 1 * 2000g = 2000g. Skincare: 1 * 100g = 100g.
    const items = [
      { name: "Anker PowerCore Charger", qty: 1, weight_g: 2000 },
      { name: "CeraVe Moisturizer", qty: 1, weight_g: 100 },
    ];
    expect(pickVendorProfile(items).category).toBe("electronics");
  });

  it("weighs by qty * weight_g, not just weight_g alone", () => {
    // Skincare: 10 * 100g = 1000g. Electronics: 1 * 200g = 200g.
    const items = [
      { name: "CeraVe Moisturizer", qty: 10, weight_g: 100 },
      { name: "Anker Charger", qty: 1, weight_g: 200 },
    ];
    expect(pickVendorProfile(items).category).toBe("skincare");
  });

  it("falls back to general for an empty item list", () => {
    expect(pickVendorProfile([]).category).toBe("general");
  });
});

describe("pickVendorName", () => {
  const profile = VENDOR_PROFILES.skincare;

  it("is deterministic — same seed always names the same vendor", () => {
    expect(pickVendorName(profile, 123)).toBe(pickVendorName(profile, 123));
  });

  it("always returns a name from the profile's own vendor list", () => {
    for (let seed = 0; seed < 30; seed++) {
      expect(profile.vendors).toContain(pickVendorName(profile, seed));
    }
  });
});

describe("resolveVendor", () => {
  it("combines category inference and deterministic naming in one call", () => {
    const items = [{ name: "Anker PowerCore Charger", qty: 1, weight_g: 400 }];
    const resolved = resolveVendor(items, 55);
    expect(resolved.profile.category).toBe("electronics");
    expect(resolved.profile.vendors).toContain(resolved.name);
  });

  it("is stable for the same items and seed across repeated calls", () => {
    const items = [{ name: "CeraVe Moisturizer", qty: 1, weight_g: 400 }];
    const a = resolveVendor(items, 99);
    const b = resolveVendor(items, 99);
    expect(a.name).toBe(b.name);
    expect(a.profile.category).toBe(b.profile.category);
  });
});
