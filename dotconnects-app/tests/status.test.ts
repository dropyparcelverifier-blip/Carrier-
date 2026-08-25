import { describe, expect, it } from "vitest";
import { isLive, modeStyle, statusStyle } from "$lib/status";
import type { Shipment } from "$lib/types";

const ALL_STATUSES: Shipment["status"][] = [
  "Order Placed",
  "Processing",
  "In Transit",
  "Customs Clearance",
  "At Warehouse",
  "Received",
];

describe("statusStyle", () => {
  it("returns a complete style object (dot/pill/bar/text) for every real status", () => {
    for (const status of ALL_STATUSES) {
      const style = statusStyle(status);
      expect(style.dot).toBeTruthy();
      expect(style.pill).toBeTruthy();
      expect(style.bar).toBeTruthy();
      expect(style.text).toBeTruthy();
    }
  });

  it("gives 'Received' the success (green) tone, not a neutral one", () => {
    expect(statusStyle("Received").dot).toContain("success");
  });

  it("gives 'Customs Clearance' the warning (amber) tone", () => {
    expect(statusStyle("Customs Clearance").dot).toContain("warn");
  });

  it("falls back to a neutral style for an unrecognised status instead of throwing", () => {
    // Cast past the type system the same way a malformed API response would
    // arrive at runtime — this must not throw.
    const style = statusStyle("Something Made Up" as Shipment["status"]);
    expect(style.dot).toContain("ink-subtle");
  });
});

describe("isLive", () => {
  it("treats in-progress statuses as live", () => {
    expect(isLive("Processing")).toBe(true);
    expect(isLive("In Transit")).toBe(true);
    expect(isLive("Customs Clearance")).toBe(true);
    expect(isLive("At Warehouse")).toBe(true);
  });

  it("treats the terminal states as not live", () => {
    expect(isLive("Order Placed")).toBe(false);
    expect(isLive("Received")).toBe(false);
  });
});

describe("modeStyle", () => {
  it("gives each shipping mode a style object", () => {
    expect(modeStyle("Air Freight").dot).toBeTruthy();
    expect(modeStyle("Ocean Freight").dot).toBeTruthy();
    expect(modeStyle("Express Air").dot).toBeTruthy();
  });

  it("distinguishes Ocean Freight from the two air modes", () => {
    const ocean = modeStyle("Ocean Freight");
    const air = modeStyle("Air Freight");
    expect(ocean.dot).not.toBe(air.dot);
  });
});
