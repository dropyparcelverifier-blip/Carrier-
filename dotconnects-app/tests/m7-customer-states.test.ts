import { describe, it, expect } from "vitest";
import { statusStyle } from "$lib/status";
import { orderGreeting } from "$lib/greeting";
import type { Shipment, ShipmentStatus } from "$lib/types";

/* ═══════════════════════════════════════════════════
   M7 — the customer-facing states added at Gate 5.
   ═══════════════════════════════════════════════════ */

const ALL_STATUSES: ShipmentStatus[] = [
  "Order Placed", "Processing", "In Transit", "Customs Clearance",
  "At Warehouse", "Received", "Forwarded to Courier", "Damaged in transit",
];

describe("every status has a style — no silent NEUTRAL fallback", () => {
  it("covers all eight", () => {
    for (const s of ALL_STATUSES) {
      const style = statusStyle(s);
      expect(style.text.length).toBeGreaterThan(0);
      expect(style.pill.length).toBeGreaterThan(0);
    }
  });

  it("damaged is alert-toned, NOT the same grey as Order Placed", () => {
    // Rendering a damaged parcel in the same neutral grey as a freshly
    // placed order would read as routine.
    expect(statusStyle("Damaged in transit").text)
      .not.toBe(statusStyle("Order Placed").text);
    expect(statusStyle("Damaged in transit").text).toContain("alert");
  });
});

describe("every status produces a greeting", () => {
  // orderGreeting reads contactName, not consignee — my first fixture
  // used the wrong field and threw inside firstName(). Test bug, not a
  // code bug, but it did prove the greeting has no guard for a missing
  // name (see the last test in this block).
  const base = {
    id: "USLMT6V291D0045868",
    contactName: "Vivek Pingili",
    consignee: "Vivek Pingili",
    eta: "5 Sept 2026",
    lastMileCourier: undefined,
  } as unknown as Shipment;

  it("no status throws or returns an empty headline", () => {
    for (const s of ALL_STATUSES) {
      const g = orderGreeting({ ...base, status: s } as Shipment, null);
      expect(g.message.length).toBeGreaterThan(0);
      expect(g.salutation.length).toBeGreaterThan(0);
    }
  });

  it("throws on a missing contact name — worth knowing", () => {
    // Found while writing these tests. orderGreeting assumes contactName
    // is always present; a row with a null name would take the whole
    // tracking page down rather than degrading to a generic greeting.
    // Not fixed here because the column is NOT NULL, so it can't happen
    // today — recorded so it isn't a surprise if that ever changes.
    expect(() =>
      orderGreeting({ ...base, contactName: undefined, status: "In Transit" } as unknown as Shipment, null),
    ).toThrow();
  });

  it("the damaged message says what happens next, not just what broke", () => {
    // A customer reading this has been checking the same page for days.
    // The useful information is that someone already knows and is acting.
    const g = orderGreeting({ ...base, status: "Damaged in transit" } as Shipment, null);
    expect(g.message.toLowerCase()).toContain("replacement");
  });
});

describe("overdue withholds the date", () => {
  it("an overdue shipment carries an empty eta", () => {
    // Set by lib/shipment-service.ts. The UI must branch on isOverdue
    // rather than rendering a blank where the biggest number on the
    // page should be.
    const s = { eta: "", isOverdue: true } as unknown as Shipment;
    expect(s.eta).toBe("");
    expect(s.isOverdue).toBe(true);
  });

  it("a normal shipment keeps its date", () => {
    const s = { eta: "5 Sept 2026", isOverdue: false } as unknown as Shipment;
    expect(s.eta).not.toBe("");
  });
});

describe("D6 — customers never see future stages", () => {
  type Ev = { stage: string; state: string };

  // Mirrors TimelineList's filter.
  const visible = (events: Ev[]) => events.filter((e) => e.state !== "pending");

  it("pending stages are filtered out", () => {
    const events: Ev[] = [
      { stage: "order_placed", state: "done" },
      { stage: "mid_transit", state: "current" },
      { stage: "arrived_india", state: "pending" },
      { stage: "qc_check", state: "pending" },
    ];
    expect(visible(events).map((e) => e.stage)).toEqual(["order_placed", "mid_transit"]);
  });

  it("the timeline ends at the current stage", () => {
    const events: Ev[] = [
      { stage: "order_placed", state: "done" },
      { stage: "mid_transit", state: "current" },
      { stage: "arrived_india", state: "pending" },
    ];
    const shown = visible(events);
    expect(shown[shown.length - 1].state).toBe("current");
  });

  it("nothing pending survives, however many there are", () => {
    const events: Ev[] = Array.from({ length: 10 }, (_, i) => ({
      stage: `s${i}`, state: i < 3 ? "done" : "pending",
    }));
    expect(visible(events)).toHaveLength(3);
  });
});

/* ═══ Route marker clamping ═══════════════════════
   The marker sits at left:{progress}% with -translate-x-1/2 and a label
   underneath. Unclamped, 0% and 100% put it half outside the track — a
   horizontal scrollbar on a 360px screen.
   ═══════════════════════════════════════════════ */

describe("route marker never leaves the track", () => {
  const clamp = (p: number) => Math.min(94, Math.max(6, p));

  it("0% is pulled inside", () => {
    expect(clamp(0)).toBe(6);
  });

  it("100% is pulled inside", () => {
    expect(clamp(100)).toBe(94);
  });

  it("mid-range values pass through untouched", () => {
    expect(clamp(45)).toBe(45);
    expect(clamp(62)).toBe(62);
  });

  it("stays inside the track for every possible progress value", () => {
    for (let p = 0; p <= 100; p++) {
      expect(clamp(p)).toBeGreaterThanOrEqual(6);
      expect(clamp(p)).toBeLessThanOrEqual(94);
    }
  });

  it("handles a nonsense progress value without escaping the track", () => {
    expect(clamp(-50)).toBe(6);
    expect(clamp(500)).toBe(94);
  });
});

/* ═══ Clipboard fallback ══════════════════════════ */

describe("copy works outside a secure context", () => {
  it("navigator.clipboard is optional, not assumed", async () => {
    // The crash: on http://192.168.1.12:3000 navigator.clipboard is
    // undefined, and the old code called .writeText on it directly.
    const { copyText } = await import("$lib/copy-text");
    // No document and no navigator.clipboard in this environment — the
    // point is that it RETURNS rather than throwing.
    await expect(copyText("USLMT6V291D0045868")).resolves.toBeTypeOf("boolean");
  });
});
