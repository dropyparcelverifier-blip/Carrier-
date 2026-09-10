import { describe, it, expect } from "vitest";
import { calendarDays, calendarWindowMs } from "../src/lib/dates";
import { stageHappenedAt } from "../src/lib/order-routes";

/**
 * The admin timeline and the customer page must name the same day.
 *
 * They didn't: create-order rounded the calendar window up and the clock
 * did not, so the same order read "24 Sept 15:06" in admin and
 * "25 Sept" to the customer.
 */
describe("calendar window", () => {
  it("rounds up — a promise landing mid-afternoon on day 14.4 is day 15", () => {
    expect(calendarDays(12)).toBe(15);   // 14.4 -> 15
    expect(calendarDays(10)).toBe(12);   // exactly 12
    expect(calendarDays(18)).toBe(22);   // 21.6 -> 22
    expect(calendarDays(30)).toBe(36);   // the cap
  });
  it("is whole days in milliseconds", () => {
    expect(calendarWindowMs(12)).toBe(15 * 24 * 60 * 60 * 1000);
  });
});

describe("the two ETAs agree", () => {
  const storedEta = (orderDate: string, days: number) => {
    const d = new Date(orderDate);
    d.setDate(d.getDate() + calendarDays(days));
    return d;
  };

  for (const days of [10, 12, 15, 18, 25]) {
    it(`${days} working days — clock and stored ETA land on the same instant`, () => {
      const orderDate = "2026-09-10T00:00:00.000Z";
      // qc_check sits at timing 1.0: the ETA the customer sees IS QC.
      const clock = stageHappenedAt("US12DONE", "qc_check", orderDate, days, 0);
      expect(clock.getTime()).toBe(storedEta(orderDate, days).getTime());
    });
  }

  it("the OLD formula was 14h24m early on a 12-day window", () => {
    const orderDate = new Date("2026-09-10T00:00:00.000Z").getTime();
    const before = orderDate + 12 * 1.2 * 864e5;      // unrounded
    const after = orderDate + calendarWindowMs(12);   // rounded
    expect(after - before).toBe(0.6 * 864e5);         // 14h24m
  });
});
