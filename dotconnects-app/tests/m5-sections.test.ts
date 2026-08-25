import { describe, it, expect } from "vitest";
import {
  SECTIONS, SECTION_KEYS, isSectionKey,
  clampPage, clampPageSize, pageRange, totalPages, sectionOrder,
  DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE,
} from "$lib/order-sections";

describe("section vocabulary", () => {
  it("matches the wireframe's five tabs plus damaged", () => {
    expect(SECTION_KEYS).toEqual([
      "transit", "ready", "picked", "delivered", "delayed", "damaged",
    ]);
  });

  it("every section has a human label", () => {
    for (const s of SECTIONS) expect(s.label.length).toBeGreaterThan(0);
  });

  it("accepts real section keys", () => {
    expect(isSectionKey("delayed")).toBe(true);
  });

  it("rejects anything else — a typo must not silently match all rows", () => {
    expect(isSectionKey("delayd")).toBe(false);
    expect(isSectionKey("")).toBe(false);
    expect(isSectionKey(null)).toBe(false);
    expect(isSectionKey("deleted")).toBe(false); // never a browsable tab
  });
});

describe("page size is clamped", () => {
  it("defaults when absent", () => {
    expect(clampPageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("defaults on garbage", () => {
    expect(clampPageSize("abc")).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(-5)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(0)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("CAPS a huge request", () => {
    // Without this, ?pageSize=100000 turns the pagination we just built
    // straight back into the unbounded fetch it replaced.
    expect(clampPageSize(100000)).toBe(MAX_PAGE_SIZE);
  });

  it("honours a reasonable request", () => {
    expect(clampPageSize(50)).toBe(50);
  });
});

describe("page number is clamped", () => {
  it("defaults to 1", () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage("abc")).toBe(1);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-3)).toBe(1);
  });

  it("honours a real page", () => {
    expect(clampPage(7)).toBe(7);
  });
});

describe("page range is inclusive at both ends", () => {
  it("page 1 of 25 is rows 0-24", () => {
    expect(pageRange(1, 25)).toEqual([0, 24]);
  });

  it("page 2 of 25 is rows 25-49 — no gap, no overlap", () => {
    const [f1, t1] = pageRange(1, 25);
    const [f2, t2] = pageRange(2, 25);
    expect(f2).toBe(t1 + 1);
    expect(t2).toBe(49);
  });

  it("never skips a row across many pages", () => {
    let expected = 0;
    for (let p = 1; p <= 20; p++) {
      const [from, to] = pageRange(p, 25);
      expect(from).toBe(expected);
      expected = to + 1;
    }
  });
});

describe("total pages", () => {
  it("is 1 when empty — never 0, or the UI shows 'page 1 of 0'", () => {
    expect(totalPages(0, 25)).toBe(1);
  });

  it("rounds up a partial page", () => {
    expect(totalPages(26, 25)).toBe(2);
    expect(totalPages(1, 25)).toBe(1);
  });

  it("is exact on a boundary", () => {
    expect(totalPages(50, 25)).toBe(2);
  });

  it("handles 10k rows", () => {
    expect(totalPages(10000, 25)).toBe(400);
  });
});

describe("section ordering", () => {
  it("delivered shows most recently delivered first", () => {
    expect(sectionOrder("delivered")).toEqual({ column: "delivered_at", ascending: false });
  });

  it("picked shows most recently collected first", () => {
    expect(sectionOrder("picked")).toEqual({ column: "picked_up_at", ascending: false });
  });

  it("DELAYED shows the longest-stuck parcel first", () => {
    // Ascending on order_date. The one that's been sitting longest is the
    // one that needs attention — burying it under newer delays is how a
    // stuck parcel stays stuck.
    expect(sectionOrder("delayed")).toEqual({ column: "order_date", ascending: true });
  });

  it("transit shows newest first", () => {
    expect(sectionOrder("transit")).toEqual({ column: "created_at", ascending: false });
  });
});

/* ═══ The section CASE, mirrored from migration-v3.sql ═══
   The database owns this logic. These tests pin the ORDER of the
   conditions, which is where it goes subtly wrong.
   ═══════════════════════════════════════════════════════ */

describe("section classification rules", () => {
  type Row = {
    deleted_at: string | null;
    current_stage: string;
    delivered_at: string | null;
    picked_up_at: string | null;
    label_generated_at: string | null;
    order_date: string;
    shipping_days: number;
  };

  const classify = (r: Row, now = Date.now()): string => {
    if (r.deleted_at) return "deleted";
    if (r.current_stage === "damaged") return "damaged";
    if (r.delivered_at) return "delivered";
    if (r.picked_up_at) return "picked";
    if (r.label_generated_at) return "ready";
    if (r.current_stage === "qc_check" || r.current_stage === "handed_to_courier") return "ready";
    if (r.current_stage === "exception") return "delayed";
    if (now > Date.parse(r.order_date) + r.shipping_days * 1.2 * 86400000) return "delayed";
    return "transit";
  };

  const fresh: Row = {
    deleted_at: null, current_stage: "mid_transit",
    delivered_at: null, picked_up_at: null, label_generated_at: null,
    order_date: new Date(Date.now() - 2 * 86400000).toISOString(),
    shipping_days: 12,
  };
  const old = { ...fresh, order_date: "2020-01-01T00:00:00.000Z" };

  it("a normal in-flight order is transit", () => {
    expect(classify(fresh)).toBe("transit");
  });

  it("past its window with no arrival is delayed", () => {
    expect(classify(old)).toBe("delayed");
  });

  it("ORDER MATTERS: a LATE but delivered order is delivered, not delayed", () => {
    // If the window check came first, every late-but-delivered order
    // would sit in Delayed forever and the tab would fill with parcels
    // that are already at the customer's door.
    expect(classify({ ...old, delivered_at: "2026-01-01T00:00:00Z", picked_up_at: "2025-12-01T00:00:00Z" }))
      .toBe("delivered");
  });

  it("ORDER MATTERS: a late but collected order is picked, not delayed", () => {
    expect(classify({ ...old, picked_up_at: "2026-01-01T00:00:00Z" })).toBe("picked");
  });

  it("ORDER MATTERS: a late but labelled order is ready, not delayed", () => {
    expect(classify({ ...old, label_generated_at: "2026-01-01T00:00:00Z" })).toBe("ready");
  });

  it("damaged beats everything except deleted", () => {
    expect(classify({ ...old, current_stage: "damaged", delivered_at: "2026-01-01T00:00:00Z" }))
      .toBe("damaged");
  });

  it("deleted beats everything", () => {
    expect(classify({ ...fresh, deleted_at: "2026-08-24T00:00:00Z", current_stage: "damaged" }))
      .toBe("deleted");
  });

  it("an admin-held order is delayed even inside its window", () => {
    expect(classify({ ...fresh, current_stage: "exception" })).toBe("delayed");
  });

  it("every order lands in exactly one section", () => {
    const rows: Row[] = [
      fresh, old,
      { ...fresh, current_stage: "damaged" },
      { ...fresh, label_generated_at: "2026-08-01T00:00:00Z" },
      { ...fresh, picked_up_at: "2026-08-01T00:00:00Z" },
      { ...fresh, delivered_at: "2026-08-01T00:00:00Z", picked_up_at: "2026-07-01T00:00:00Z" },
      { ...fresh, deleted_at: "2026-08-01T00:00:00Z" },
      { ...fresh, current_stage: "exception" },
    ];
    for (const r of rows) {
      const s = classify(r);
      expect([...SECTION_KEYS, "deleted"]).toContain(s);
    }
  });
});
