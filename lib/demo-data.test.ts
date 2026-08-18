import { describe, expect, it } from "vitest";
import { DEMO_SHIPMENTS } from "./demo-data";
import { relativeDays } from "./dates";

describe("DEMO_SHIPMENTS dates stay evergreen", () => {
  it("never shows a past-due ETA for a shipment that hasn't been delivered", () => {
    // Regression test for a real bug: hardcoded demo dates went stale and
    // a "Customs Clearance" order started showing "ETA 8 days ago", which
    // reads as broken (the order looks overdue) even though nothing was
    // actually wrong — the dates were just fixed calendar strings written
    // once and never revisited. DEMO_SHIPMENTS now computes its non-final
    // shipments' dates relative to today (lib/demo-data.ts `dayOffset`),
    // so this must hold no matter when the test runs.
    for (const shipment of DEMO_SHIPMENTS) {
      if (shipment.status === "Received") continue; // a past ETA is correct once delivered
      const diff = relativeDays(shipment.eta);
      expect(diff).not.toBeNull();
      expect(diff).not.toMatch(/ago$/);
    }
  });

  it("keeps the delivered demo shipment's ETA in the past, honestly", () => {
    const delivered = DEMO_SHIPMENTS.find((s) => s.status === "Received");
    expect(delivered).toBeDefined();
    expect(relativeDays(delivered!.eta)).toMatch(/ago$|^Today$/);
  });

  it("orders shippedOn before eta for every shipment", () => {
    for (const shipment of DEMO_SHIPMENTS) {
      expect(new Date(shipment.shippedOn).getTime()).toBeLessThanOrEqual(
        new Date(shipment.eta).getTime(),
      );
    }
  });
});
