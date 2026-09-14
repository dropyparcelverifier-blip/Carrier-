import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const HELPER = readFileSync("src/lib/server/hold-event.ts", "utf8");
const CANCEL = readFileSync("src/routes/api/admin/orders/[id]/cancel/+server.ts", "utf8");
const DAMAGED = readFileSync("src/routes/api/admin/orders/[id]/damaged/+server.ts", "utf8");
const AUDIT = readFileSync("src/lib/server/audit.ts", "utf8");
const SQL = readFileSync("supabase/migration-v8.sql", "utf8");

describe("a hold state reaches the customer's trail", () => {
  it("cancel writes one", () => {
    expect(CANCEL).toMatch(/recordHoldEvent\(supabase, order\.id, "cancelled"/);
  });

  it("damaged writes one", () => {
    expect(DAMAGED).toMatch(/recordHoldEvent\(supabase, order\.id, "damaged"/);
  });

  it("both go through the same helper — not two copies of the rule", () => {
    // Two timelines that disagreed, five copied clock guards, two payload
    // builders. Same mistake each time.
    for (const src of [CANCEL, DAMAGED]) {
      expect(src).toContain('from "$lib/server/hold-event"');
      expect(src, "the endpoint should not insert events itself")
        .not.toContain('from("dropy_order_events")');
    }
  });
});

describe("what the customer is told", () => {
  it("says Order Cancelled by Vendor, and nothing more", () => {
    expect(HELPER).toContain("Order Cancelled by Vendor.");
  });

  it("never passes the teammate's reason through", () => {
    // The reason is internal shorthand and stays in the audit log. A
    // customer reading "wrong address given" on their own tracking page
    // is a support ticket nobody needed.
    //
    // Asserted against CODE, not prose — the first version of this
    // matched the comment that explains the rule and failed on a helper
    // that obeys it.
    const code = HELPER
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code, "the helper takes no reason and forwards none")
      .not.toMatch(/\breason\b/);
    // note comes from the fixed HOLD table, never from an argument.
    expect(code).toMatch(/note:\s*copy\.note/);
  });

  it("sorts after every journey stage", () => {
    // handed_to_courier, the last route point, is 13. A terminal hold
    // belongs at the end of the trail whatever stage was reached.
    expect(HELPER).toMatch(/HOLD_SORT_ORDER = 99/);
  });

  it("does not duplicate on a retry", () => {
    expect(HELPER).toMatch(/some\(\(ev: any\) => ev\.stage === stage\)/);
  });

  it("clears the previous stage's live styling", () => {
    expect(HELPER).toMatch(/ev\.state === "current"/);
  });
});

describe("a bridge action is no longer dropped from the audit log", () => {
  it("logAudit routes a null actor id to the system writer", () => {
    // requireStaffOrBridge returns a named identity with a null id for a
    // DOC call. Written as actor_type "user" those rows were rejected and
    // thrown away silently, because writeAuditRow swallows its errors by
    // design. Cancel, damaged, add-days and delay were all affected.
    expect(AUDIT).toMatch(/if \(actor\.id == null\)/);
    expect(AUDIT).toMatch(/logSystemAudit\(actor\.username/);
  });

  it("fixes it once, not at four call sites", () => {
    for (const src of [CANCEL, DAMAGED]) {
      expect(src, "endpoints should keep calling logAudit")
        .toContain("logAudit(identity");
    }
  });
});

describe("the backfill", () => {
  it("is safe to run twice", () => {
    expect(SQL).toMatch(/not exists \(/);
  });

  it("skips deleted rows", () => {
    expect(SQL).toMatch(/o\.deleted_at is null/);
  });

  it("anchors to updated_at, the only honest timestamp available", () => {
    // No cancelled_at column, and the audit log holds nothing for these
    // actions. For a parcel untouched since, updated_at IS the moment.
    expect(SQL).toMatch(/coalesce\(o\.updated_at, now\(\)\)/);
  });
});
