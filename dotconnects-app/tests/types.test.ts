import { describe, expect, it, vi, afterEach } from "vitest";
import {
  currentEvent,
  matchesQuery,
  suggestStage,
  type Shipment,
  type TrackingEvent,
} from "$lib/types";

function makeEvent(overrides: Partial<TrackingEvent> = {}): TrackingEvent {
  return {
    stage: "order_placed",
    label: "Order placed",
    location: "dropy.in",
    timestamp: "01 Jan 2026",
    state: "done",
    ...overrides,
  };
}

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: "DRP-2026-0001",
    reference: "ORD-1001",
    consignee: "Test Consignee",
    consigneeCity: "Mumbai",
    contactName: "Test Contact",
    description: "Test items",
    category: "Skincare",
    brands: ["TestBrand"],
    status: "In Transit",
    mode: "Air Freight",
    origin: "Newark, NJ",
    originPort: "Dropy USA Warehouse",
    destination: "Mumbai",
    destinationPort: "Dropy Vashi Warehouse",
    carrier: "Dropy Logistics",
    containerOrAwb: "098-0000-0000",
    pieces: 1,
    skuCount: 1,
    batchCount: 1,
    weightKg: 1,
    declaredValueUsd: 10,
    hsCode: "3304.99",
    dutyPaid: false,
    cdscoRegistration: null,
    fssaiLicence: null,
    shelfLifeRemaining: "",
    tempControlled: false,
    shippedOn: "01 Jan 2026",
    eta: "10 Jan 2026",
    progress: 50,
    events: [makeEvent()],
    ...overrides,
  };
}

describe("matchesQuery", () => {
  it("matches an exact tracking id, case- and hyphen/space-insensitively", () => {
    const s = makeShipment({ id: "DRP-2026-0421" });
    expect(matchesQuery(s, "DRP-2026-0421")).toBe(true);
    expect(matchesQuery(s, "drp-2026-0421")).toBe(true);
    expect(matchesQuery(s, "drp 2026 0421")).toBe(true);
    expect(matchesQuery(s, "drp20260421")).toBe(true);
  });

  it("matches an exact order reference or AWB number", () => {
    const s = makeShipment({ reference: "ORD-9981", containerOrAwb: "098-4421-7788" });
    expect(matchesQuery(s, "ORD-9981")).toBe(true);
    expect(matchesQuery(s, "098-4421-7788")).toBe(true);
  });

  it("does not match a partial id substring — only exact (normalised) matches", () => {
    const s = makeShipment({ id: "DRP-2026-0421" });
    expect(matchesQuery(s, "DRP-2026")).toBe(false);
    expect(matchesQuery(s, "0421")).toBe(false);
  });

  it("returns false for an empty query", () => {
    const s = makeShipment();
    expect(matchesQuery(s, "")).toBe(false);
    expect(matchesQuery(s, "   ")).toBe(false);
  });

  it("never matches on consignee/contact name unless allowNameSearch is explicitly true", () => {
    const s = makeShipment({ consignee: "Rahul Mehta" });
    expect(matchesQuery(s, "Rahul")).toBe(false);
    expect(matchesQuery(s, "Rahul", { allowNameSearch: false })).toBe(false);
    expect(matchesQuery(s, "Rahul", { allowNameSearch: true })).toBe(true);
  });

  it("public lookup (no allowNameSearch) is exact-id-only, by design — the app/api/track route relies on this to keep name search behind sign-in", () => {
    const s = makeShipment({ id: "DRP-2026-0421", consignee: "Rahul Mehta" });
    expect(matchesQuery(s, "Rahul Mehta")).toBe(false);
    expect(matchesQuery(s, "DRP-2026-0421")).toBe(true);
  });
});

describe("currentEvent", () => {
  it("prefers an exception-state event over everything else", () => {
    const s = makeShipment({
      events: [
        makeEvent({ stage: "order_placed", state: "done" }),
        makeEvent({ stage: "packed", state: "exception" }),
        makeEvent({ stage: "dispatched", state: "current" }),
      ],
    });
    expect(currentEvent(s).stage).toBe("packed");
  });

  it("falls back to the current-state event when there's no exception", () => {
    const s = makeShipment({
      events: [
        makeEvent({ stage: "order_placed", state: "done" }),
        makeEvent({ stage: "dispatched", state: "current" }),
        makeEvent({ stage: "arrived_india", state: "pending" }),
      ],
    });
    expect(currentEvent(s).stage).toBe("dispatched");
  });

  it("falls back to the last event when nothing is current or exception (e.g. fully delivered)", () => {
    const s = makeShipment({
      events: [
        makeEvent({ stage: "order_placed", state: "done" }),
        makeEvent({ stage: "at_vashi_warehouse", state: "done" }),
      ],
    });
    expect(currentEvent(s).stage).toBe("at_vashi_warehouse");
  });
});

describe("suggestStage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("suggests the first stage right when an order is placed", () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-13T12:00:00");
    vi.setSystemTime(now);
    expect(suggestStage(now.toISOString(), 10)).toBe("order_placed");
  });

  it("suggests the final stage once the full shipping window has elapsed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00"));
    // Ordered 30 days ago, a 10-working-day shipment — well past 100%.
    const orderedAt = new Date("2026-07-14T12:00:00").toISOString();
    expect(suggestStage(orderedAt, 10)).toBe("qc_check");
  });

  it("suggests a mid-pipeline stage partway through the shipping window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00"));
    // 10 shipping days ≈ 12 calendar days (1.2×); 7 days in is ~58% —
    // should land past order_placed but short of delivery.
    const orderedAt = new Date("2026-08-06T12:00:00").toISOString();
    const stage = suggestStage(orderedAt, 10);
    expect(stage).not.toBe("order_placed");
    expect(stage).not.toBe("qc_check");
  });
});
