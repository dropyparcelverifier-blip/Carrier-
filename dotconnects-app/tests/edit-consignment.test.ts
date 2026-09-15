import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { journeyView } from "$lib/journey";
import { STAGES } from "$lib/types";

const EDIT = readFileSync("src/routes/api/admin/orders/[id]/edit/+server.ts", "utf8");

/* ═══════════════════════════════════════════════════
   Correcting a consignment built wrong. The danger is not that it
   fails — it is that it succeeds and quietly moves something it had no
   business moving, because every field on the row looks equally
   editable from inside the endpoint.
   ═══════════════════════════════════════════════════ */

describe("what edit must never touch", () => {
  /* Each of these was fixed at push time from the ORDER'S WINDOW, not
     from the contents. Recomputing any of them would move a customer's
     arrival date because a teammate fixed their own typo. */
  const FROZEN = [
    "tracking_id", "route_key", "timing_seed", "order_date",
    "shipping_days", "estimated_delivery", "doorstep_days", "current_stage",
  ];

  it("writes none of them into the patch", () => {
    // The patch object is the only thing that reaches the update.
    const patchWrites = [...EDIT.matchAll(/patch\.(\w+)\s*=/g)].map((m) => m[1]);
    const inPatch = [...EDIT.matchAll(/patch:\s*Record[^=]*=\s*\{([\s\S]*?)\n  \};/g)]
      .flatMap((m) => [...m[1].matchAll(/^\s*(\w+):/gm)].map((x) => x[1]));
    const written = new Set([...patchWrites, ...inPatch]);
    for (const f of FROZEN) {
      expect(written, `edit must not write ${f}`).not.toContain(f);
    }
  });

  it("only writes contents and the vendor reference", () => {
    const patchWrites = [...EDIT.matchAll(/patch\.(\w+)\s*=/g)].map((m) => m[1]);
    const allowed = new Set([
      "items", "total_items", "total_weight_kg", "declared_value_usd", "us_order_id",
    ]);
    for (const f of patchWrites) {
      expect(allowed, `unexpected field written: ${f}`).toContain(f);
    }
  });
});

describe("the editable window", () => {
  const row = (stage: string, days = 12) => ({
    current_stage: stage, route_key: "US15DTHREE",
    order_date: new Date(Date.now() - 1000).toISOString(),
    shipping_days: days, timing_seed: 0,
  });

  it("closes once the box is with the carrier", () => {
    // `dispatched` onward the parcel has left; changing the record then
    // only makes DOC disagree with reality rather than with DOT.
    expect(EDIT).toMatch(/LAST_EDITABLE = "packed"/);
    const idx = (k: string) => STAGES.findIndex((s) => s.key === k);
    expect(idx("dispatched")).toBeGreaterThan(idx("packed"));
  });

  it("refuses a damaged or cancelled consignment", () => {
    // A damaged parcel's contents are what it was damaged with; a
    // cancelled one is still flying to Vashi with whatever is inside.
    expect(EDIT).toMatch(/view\.frozen \|\| view\.capped/);
    expect(journeyView(row("damaged")).frozen).toBe(true);
    expect(journeyView(row("cancelled")).capped).toBe(true);
  });

  it("a fresh parcel is editable", () => {
    const v = journeyView(row("order_placed"));
    expect(v.frozen).toBe(false);
    expect(v.capped).toBe(false);
  });
});

describe("guards that must fire before anything is written", () => {
  it("requires a reason", () => {
    // Every edit is somebody correcting a mistake. Weekly edits mean the
    // split-building step needs fixing, and without a reason there is
    // nothing to count.
    expect(EDIT).toMatch(/if \(!reason\)/);
  });

  it("refuses to empty a consignment", () => {
    // A tracking with no items is a parcel that does not exist, and the
    // customer already holds that link. That is a cancellation.
    expect(EDIT).toMatch(/cannot be emptied here/);
  });

  it("refuses a US order id already live on another consignment", () => {
    expect(EDIT).toMatch(/\.eq\("us_order_id", newUsId\)/);
    expect(EDIT).toMatch(/\.neq\("id", order\.id\)/);
    expect(EDIT).toMatch(/\.is\("deleted_at", null\)/);
  });

  it("writes no customer-facing event", () => {
    // The item count changes silently. "We changed what is in your
    // parcel" invites a question nobody wants, and nothing befell the
    // shipment — this is an internal correction.
    expect(EDIT).not.toContain("dropy_order_events");
    expect(EDIT).not.toContain("recordHoldEvent");
  });

  it("records the tracking-id staleness rather than hiding it", () => {
    expect(EDIT).toMatch(/tracking_digits_now_stale/);
  });
});
