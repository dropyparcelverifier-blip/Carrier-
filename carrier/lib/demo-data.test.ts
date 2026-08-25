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
      // A past ETA is correct once actually delivered/handed off — qc_check
      // ("Received") means QC-passed at Vashi, "Forwarded to Courier"
      // (handed_to_courier) is this app's real final tracked state.
      if (shipment.status === "Received" || shipment.status === "Forwarded to Courier") continue;
      const diff = relativeDays(shipment.eta);
      expect(diff).not.toBeNull();
      expect(diff).not.toMatch(/ago$/);
    }
  });

  it("keeps the delivered demo shipment's ETA in the past, honestly", () => {
    const delivered = DEMO_SHIPMENTS.find((s) => s.status === "Forwarded to Courier");
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

  it("never shows a later stage with an earlier calendar date than the one before it", () => {
    // Regression test for a real bug: a weekend-avoidance tweak nudged the
    // "processing"/"packed" warehouse events forward to the next Monday
    // without shifting "dispatched" (which runs every day, weekends
    // included) to match — so a shipment could render as packed *after* it
    // was already dispatched. Every dated event in a shipment's timeline
    // must be on the same day as, or after, the one before it.
    for (const shipment of DEMO_SHIPMENTS) {
      let lastDate: Date | null = null;
      for (const event of shipment.events) {
        if (!event.timestamp) continue; // pending stages carry no timestamp yet
        const datePart = event.timestamp.split(" · ")[0];
        const eventDate = new Date(datePart);
        if (lastDate) {
          expect(eventDate.getTime()).toBeGreaterThanOrEqual(lastDate.getTime());
        }
        lastDate = eventDate;
      }
    }
  });
});
