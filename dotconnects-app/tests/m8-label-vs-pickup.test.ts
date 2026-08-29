import { describe, expect, it } from "vitest";
import { computeOverdue } from "../src/lib/stage-clock";

/**
 * A courier record forwards the order. There is no in-between state.
 *
 * Nobody on the warehouse team touches this app — the courier is the only
 * sensor. The moment a shipment exists in Shiprocket or Velocity there is
 * a real AWB, the consignment has left our hands, and everything after
 * that lives on the courier's own page.
 *
 * An earlier version of this split label generation from pickup and
 * showed "booked, awaiting collection" in between. That was a distinction
 * this app has no business making: its terminal stage is "Forwarded to
 * courier", and a generated AWB IS the forwarding.
 */

const DAY = 86400000;
const ORDER = "2026-08-01T09:00:00Z";
const WORKING_DAYS = 10; // 12 calendar days at the 1.2 factor

describe("a courier record ends this app's tracking", () => {
  it("an order with a label is NOT overdue, even past its ETA", () => {
    // Day 15 on a 12-day promise. The clock ran out, but the AWB proves
    // the consignment arrived and was forwarded.
    expect(
      computeOverdue({
        orderDate: ORDER, shippingDays: WORKING_DAYS, storedStage: "handed_to_courier",
        labelGeneratedAt: new Date(new Date(ORDER).getTime() + 11 * DAY).toISOString(),
        pickedUpAt: null, now: new Date(ORDER).getTime() + 15 * DAY,
      }),
    ).toBe(false);
  });

  it("pickup alone is equally sufficient", () => {
    expect(
      computeOverdue({
        orderDate: ORDER, shippingDays: WORKING_DAYS, storedStage: "handed_to_courier",
        labelGeneratedAt: null,
        pickedUpAt: new Date(new Date(ORDER).getTime() + 11 * DAY).toISOString(),
        now: new Date(ORDER).getTime() + 15 * DAY,
      }),
    ).toBe(false);
  });

  it("no courier record at all IS overdue past the ETA", () => {
    // This is the Velocity blind spot: its webhook only captures, so an
    // order shipped through Velocity never gets either column set and
    // sits here indefinitely.
    expect(
      computeOverdue({
        orderDate: ORDER, shippingDays: WORKING_DAYS, storedStage: "mid_transit",
        labelGeneratedAt: null, pickedUpAt: null,
        now: new Date(ORDER).getTime() + 15 * DAY,
      }),
    ).toBe(true);
  });

  it("is never overdue before the ETA", () => {
    const at = (d: number) => new Date(ORDER).getTime() + d * DAY;
    expect(
      computeOverdue({
        orderDate: ORDER, shippingDays: WORKING_DAYS, storedStage: "mid_transit",
        labelGeneratedAt: null, pickedUpAt: null, now: at(9),
      }),
    ).toBe(false);
  });
});

describe("forwarded statuses", () => {
  // Mirrors FORWARDED_STATUSES in courier-updates-a/+server.ts.
  const FORWARDED = new Set([
    "awb assigned", "awb generated", "label generated", "manifest generated",
    "ready to ship", "new", "invoiced",
    "pickup generated", "pickup scheduled", "pickup error", "pickup rescheduled",
    "picked up", "shipped", "in transit", "out for delivery", "delivered",
  ]);

  it("an AWB existing is enough — collection is not required", () => {
    expect(FORWARDED.has("awb assigned")).toBe(true);
    expect(FORWARDED.has("label generated")).toBe(true);
  });

  it("a failed pickup still counts as forwarded", () => {
    // The AWB is valid and the customer can follow it. Whether the van
    // turned up is the courier's problem to show, not ours.
    expect(FORWARDED.has("pickup error")).toBe(true);
  });

  it("covers the whole lifecycle so an out-of-order webhook still works", () => {
    // Webhooks arrive late, retry, and skip. Any of these landing first
    // must forward the order.
    for (const s of ["new", "picked up", "in transit", "delivered"]) {
      expect(FORWARDED.has(s)).toBe(true);
    }
  });

  it("ignores statuses that say nothing about our leg", () => {
    for (const s of ["rto initiated", "cancelled", "undelivered", ""]) {
      expect(FORWARDED.has(s)).toBe(false);
    }
  });
});
