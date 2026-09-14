import { describe, it, expect } from "vitest";
import { etaFor, formatEta, calendarDays } from "$lib/dates";
import { stageToStatus } from "$lib/admin-stages";

/* ═══════════════════════════════════════════════════
   Door Step EDD — the second date on the customer card.

   The rule: doorstep = Vashi arrival + doorstep_days, where
   doorstep_days is a flat 1-day buffer plus the ceiling of the median
   Shiprocket courier estimate for the pincode. Order Central computes
   the number; DOT only ever adds it to a date it already knows.
   ═══════════════════════════════════════════════════ */

const ORDER_DATE = "2026-09-01T00:00:00.000Z";

describe("etaFor — the Vashi date", () => {
  it("matches the arithmetic that writes estimated_delivery", () => {
    // create-order and both add-days endpoints do order_date +
    // calendarDays(shipping_days). If this drifts, the two dates on the
    // card disagree and nothing errors.
    const { dropy } = etaFor({ order_date: ORDER_DATE, shipping_days: 12 });
    const expected = new Date(ORDER_DATE);
    expected.setDate(expected.getDate() + calendarDays(12));
    expect(formatEta(dropy)).toBe(formatEta(expected));
  });
});

describe("etaFor — the doorstep date", () => {
  it("adds doorstep_days to the Vashi date, not to the order date", () => {
    const { dropy, doorstep } = etaFor({
      order_date: ORDER_DATE, shipping_days: 12, doorstep_days: 5,
    });
    expect(doorstep).not.toBeNull();
    const gap = Math.round((doorstep!.getTime() - dropy.getTime()) / 86_400_000);
    expect(gap).toBe(5);
  });

  it("moves with the window — extending shipping_days moves BOTH dates", () => {
    // The whole reason a NUMBER is stored instead of a date. add-days
    // updates shipping_days; if the doorstep date were stored it would
    // be a third value to move, and the one time that was missed the
    // customer sat on a stale date while every stage stretched.
    const before = etaFor({ order_date: ORDER_DATE, shipping_days: 12, doorstep_days: 5 });
    const after  = etaFor({ order_date: ORDER_DATE, shipping_days: 15, doorstep_days: 5 });

    const moved = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);
    expect(moved(before.dropy, after.dropy)).toBeGreaterThan(0);
    // Both move by exactly the same amount — the gap is preserved.
    expect(moved(before.dropy, after.dropy))
      .toBe(moved(before.doorstep!, after.doorstep!));
  });

  it("is null when there is no figure — the ordinary case, not an error", () => {
    // Every row written before this shipped, plus any pincode Shiprocket
    // cannot service, plus a Shiprocket outage at push time.
    for (const doorstep_days of [undefined, null, 0]) {
      const { doorstep } = etaFor({ order_date: ORDER_DATE, shipping_days: 12, doorstep_days });
      expect(doorstep).toBeNull();
    }
  });

  it("refuses a negative figure rather than promising an earlier date", () => {
    const { doorstep } = etaFor({ order_date: ORDER_DATE, shipping_days: 12, doorstep_days: -3 });
    expect(doorstep).toBeNull();
  });

  it("rounds a fractional figure UP, the same direction as the working→calendar conversion", () => {
    const { dropy, doorstep } = etaFor({
      order_date: ORDER_DATE, shipping_days: 12, doorstep_days: 3.5,
    });
    const gap = Math.round((doorstep!.getTime() - dropy.getTime()) / 86_400_000);
    expect(gap).toBe(4);
  });

  it("crosses a month boundary correctly", () => {
    // Date arithmetic by setDate, not by adding milliseconds.
    const { doorstep } = etaFor({
      order_date: "2026-09-20T00:00:00.000Z", shipping_days: 10, doorstep_days: 4,
    });
    expect(formatEta(doorstep!)).toContain("Oct");
  });
});

describe("stageToStatus — hold states are not points on the journey", () => {
  /* The customer page derives its damaged and cancelled branches from
     this string. Without these cases the fallback claimed "Order
     Placed", so BOTH branches were unreachable and a held parcel
     rendered as a live one with a date and a progress bar. */
  it("reports a damaged parcel as damaged", () => {
    expect(stageToStatus("damaged")).toBe("Damaged in transit");
  });

  it("reports a cancelled tracking as cancelled", () => {
    expect(stageToStatus("cancelled")).toBe("Cancelled");
  });

  it("does NOT report either as Order Placed", () => {
    // The specific regression. Asserting the positive above would still
    // pass if someone reintroduced the fallback for one of them.
    expect(stageToStatus("damaged")).not.toBe("Order Placed");
    expect(stageToStatus("cancelled")).not.toBe("Order Placed");
  });

  it("still falls back for a genuinely unknown stage", () => {
    expect(stageToStatus("not_a_stage")).toBe("Order Placed");
  });
});
