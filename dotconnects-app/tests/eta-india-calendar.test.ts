import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { etaFor, formatEta } from "../src/lib/dates";

/* 26 Sept: an order whose clock started between 00:00 and 05:29 IST was
   still on the previous day in UTC — the server's zone — so its
   reach-India and doorstep dates printed one day early. The date must
   come out the same whatever zone the server runs in (this file runs
   under TZ=Asia/Kolkata and TZ=UTC). */
const row = (order_date: string) => ({ order_date, shipping_days: 15, doorstep_days: 5 });

describe("ETA dates are on the India calendar", () => {
  it("#Dropy-4853 (clock 11 Sept 5:52 pm IST, 15 working days, Delhi +5): India 29 Sept, door 04 Oct", () => {
    const { dropy, doorstep } = etaFor(row("2026-09-11T17:52:00+05:30"));
    expect(formatEta(dropy)).toBe(formatEta(new Date("2026-09-29T12:00:00+05:30")));
    expect(formatEta(doorstep!)).toBe(formatEta(new Date("2026-10-04T12:00:00+05:30")));
    expect(formatEta(dropy)).toMatch(/^29 Sept? 2026$/);
  });
  it("clock at 1:00 am and 5:00 am IST → 30 Sept (not 29), door 05 Oct", () => {
    for (const t of ["2026-09-12T01:00:00+05:30", "2026-09-12T05:00:00+05:30"]) {
      const { dropy, doorstep } = etaFor(row(t));
      expect(formatEta(dropy), t).toMatch(/^30 Sept? 2026$/);
      expect(formatEta(doorstep!), t).toBe("05 Oct 2026");
    }
  });
  it("11:30 pm and 6:00 am are unchanged", () => {
    expect(formatEta(etaFor(row("2026-09-11T23:30:00+05:30")).dropy)).toMatch(/^29 Sept? 2026$/);
    expect(formatEta(etaFor(row("2026-09-12T06:00:00+05:30")).dropy)).toMatch(/^30 Sept? 2026$/);
  });
  it("a plain calendar date (UTC midnight) still prints as that same day", () => {
    expect(formatEta(new Date(Date.UTC(2026, 9, 4)))).toBe("04 Oct 2026");
  });
  it("the stored estimated_delivery is written through formatEta everywhere", () => {
    expect(readFileSync("src/lib/server/create-order.ts", "utf8")).toMatch(/estimated_delivery: formatEta\(eta\)/);
    expect(readFileSync("src/routes/api/admin/orders/[id]/add-days/+server.ts", "utf8")).toMatch(/estimated_delivery: formatEta\(etaAfter\)/);
  });
});
