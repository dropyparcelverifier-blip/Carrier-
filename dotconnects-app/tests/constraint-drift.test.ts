import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { STAGES } from "$lib/types";
import { stageToStatus } from "$lib/admin-stages";

/* ═══════════════════════════════════════════════════
   The check constraints are a hand-kept copy of these TypeScript
   constants, and they have fallen out of step twice:

     * 'damaged' and 'cancelled' shipped in code while dropy_orders
       rejected both. Nothing failed until a real write, weeks later.
     * payment_status: 'Paid' was rejected the same way, after
       validation had already passed.

   Neither was caught by a build or by a test, because nothing tied the
   two lists together. This does. It is not the durable fix -- that is
   generating the SQL from these constants -- but it turns a silent
   divergence into a red test in the same commit that causes it.
   ═══════════════════════════════════════════════════ */

const SQL =
  readFileSync("supabase/migration-v7-constraints.sql", "utf8") +
  readFileSync("supabase/migration-v8.sql", "utf8");

/** The quoted values inside one named constraint's array literal. */
function permitted(constraint: string): string[] {
  const block = SQL.split(`add constraint ${constraint}`)[1];
  expect(block, `${constraint} is not defined in the migration`).toBeTruthy();
  const arr = block.split("array[")[1]?.split("]")[0] ?? "";
  return [...arr.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const STAGE_VALUES = permitted("dropy_orders_current_stage_check");
const STATUS_VALUES = permitted("dropy_orders_status_check");

/* Not points on the journey, so not in STAGES — but the columns must
   accept them or the action that writes them fails at the database. */
const HOLD_STAGES = ["exception", "damaged", "cancelled"];

describe("current_stage constraint covers everything the code writes", () => {
  it("permits all 14 canonical stages", () => {
    for (const s of STAGES) {
      expect(STAGE_VALUES, `stage "${s.key}" is in STAGES but not in the constraint`)
        .toContain(s.key);
    }
  });

  it("permits every hold state", () => {
    for (const s of HOLD_STAGES) {
      expect(STAGE_VALUES, `hold state "${s}" would be rejected by the database`)
        .toContain(s);
    }
  });

  it("permits nothing else — a stray value here is a typo, not a feature", () => {
    const known = new Set([...STAGES.map((s) => s.key), ...HOLD_STAGES]);
    for (const v of STAGE_VALUES) {
      expect(known, `constraint permits "${v}", which no code writes`).toContain(v);
    }
  });
});

describe("status constraint covers everything stageToStatus can return", () => {
  it("permits the status of every stage the column can hold", () => {
    // Drives it through the real function rather than a second list —
    // a second list is the disease, not the cure.
    for (const stage of [...STAGES.map((s) => s.key), ...HOLD_STAGES]) {
      const status = stageToStatus(stage);
      expect(STATUS_VALUES, `stageToStatus("${stage}") returns "${status}", which the database rejects`)
        .toContain(status);
    }
  });

  it("permits Cancelled — the value dot-findings-14-sept.md omits", () => {
    // The written record listed eight statuses and left this one out,
    // while live had it. Rebuilding from that doc would have made
    // cancel-tracking fail at the database with no warning.
    expect(STATUS_VALUES).toContain("Cancelled");
  });

  it("permits Damaged in transit", () => {
    expect(STATUS_VALUES).toContain("Damaged in transit");
  });
});

describe("dropy_order_events.stage accepts every stage an event is written for", () => {
  /* The THIRD instance of this bug. dropy_orders.current_stage was
     missing damaged and cancelled; payment_status was missing "Paid";
     and this table was missing cancelled while already permitting
     damaged and exception — so "the column already takes a non-journey
     value" was true and still not enough. */
  const EVENT_VALUES = permitted("dropy_order_events_stage_check");

  it("permits all 14 canonical stages", () => {
    for (const s of STAGES) {
      expect(EVENT_VALUES, `an event for "${s.key}" could not be stored`).toContain(s.key);
    }
  });

  it("permits every hold state an endpoint writes an event for", () => {
    // order-status.ts writes exception; cancel and damaged write their
    // own via lib/server/hold-event.ts.
    for (const s of HOLD_STAGES) {
      expect(EVENT_VALUES, `hold event "${s}" would be rejected by the database`)
        .toContain(s);
    }
  });

  it("agrees with the current_stage constraint — one parcel, one vocabulary", () => {
    // A stage storable on the order but not on its events produces an
    // order in a state whose timeline cannot record how it got there.
    expect([...EVENT_VALUES].sort()).toEqual([...STAGE_VALUES].sort());
  });
});
