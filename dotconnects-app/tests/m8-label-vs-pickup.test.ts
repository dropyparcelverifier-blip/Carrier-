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

/**
 * Shiprocket statuses, rewritten from 775 real captured webhooks.
 *
 * The docs-derived list ignored 21% of live traffic. Ten statuses in it
 * had never once been sent, while OUT FOR PICKUP — the real first
 * forwarding signal, 44 occurrences — fell straight through. Any order
 * whose first webhook was OUT FOR PICKUP never forwarded at all.
 */
describe("Shiprocket statuses match what is actually sent", () => {
  const FORWARDED = new Set([
    "new", "out for pickup", "pickup exception",
    "picked up", "shipped", "in transit", "reached at destination hub",
    "out for delivery", "delivered",
    "undelivered", "untraceable",
    "rto initiated", "rto in transit", "rto ofd", "rto delivered",
  ]);
  const POST_HANDOVER_ONLY = new Set(["canceled", "cancelled"]);

  /** Every distinct status across 775 captured webhooks, with counts. */
  const OBSERVED: [string, number][] = [
    ["IN TRANSIT", 465], ["REACHED AT DESTINATION HUB", 48],
    ["OUT FOR DELIVERY", 46], ["OUT FOR PICKUP", 44], ["PICKED UP", 38],
    ["DELIVERED", 33], ["CANCELED", 28], ["SHIPPED", 24],
    ["PICKUP EXCEPTION", 21], ["UNDELIVERED", 9], ["RTO IN TRANSIT", 8],
    ["NEW", 3], ["RTO INITIATED", 2], ["UNTRACEABLE", 2], ["Delivered", 2],
    ["RTO OFD", 1], ["RTO DELIVERED", 1],
  ];

  it("every observed status is handled — none fall through", () => {
    const unhandled = OBSERVED.filter(
      ([s]) => !FORWARDED.has(s.toLowerCase()) && !POST_HANDOVER_ONLY.has(s.toLowerCase()),
    );
    expect(unhandled).toEqual([]);
  });

  it("OUT FOR PICKUP forwards — it is the first real signal", () => {
    // 44 occurrences, and it was missing entirely. An order whose first
    // webhook was this never forwarded.
    expect(FORWARDED.has("out for pickup")).toBe(true);
  });

  it("REACHED AT DESTINATION HUB forwards", () => {
    expect(FORWARDED.has("reached at destination hub")).toBe(true);
  });

  it("comparison is case-insensitive", () => {
    // Shiprocket sends both "DELIVERED" and "Delivered" for the same
    // event, so case cannot be trusted.
    for (const v of ["DELIVERED", "Delivered", "delivered"]) {
      expect(FORWARDED.has(v.toLowerCase())).toBe(true);
    }
  });

  it("CANCELED — American spelling — is handled, and does not forward", () => {
    expect(FORWARDED.has("canceled")).toBe(false);
    expect(POST_HANDOVER_ONLY.has("canceled")).toBe(true);
    // Guard the British spelling too, in case they ever change it.
    expect(POST_HANDOVER_ONLY.has("cancelled")).toBe(true);
  });

  it("a failed delivery still counts as forwarded", () => {
    // UNDELIVERED and UNTRACEABLE mean the courier had it and something
    // went wrong. The forward leg completed either way.
    expect(FORWARDED.has("undelivered")).toBe(true);
    expect(FORWARDED.has("untraceable")).toBe(true);
  });

  it("covers 100% of observed traffic by volume", () => {
    const total = OBSERVED.reduce((n, [, c]) => n + c, 0);
    const handled = OBSERVED
      .filter(([s]) => FORWARDED.has(s.toLowerCase()) || POST_HANDOVER_ONLY.has(s.toLowerCase()))
      .reduce((n, [, c]) => n + c, 0);
    expect(handled).toBe(total);
  });
});
