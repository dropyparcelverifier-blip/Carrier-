import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { LAST_MILE_COURIERS } from "../src/lib/last-mile";

/* Order Central booking the India leg IS the handover. Until this
 * endpoint existed the only route to handed_to_courier was a courier
 * webhook happening to arrive, so the stage confirmed a handover rather
 * than recording one — and for a parcel whose courier never fired a
 * webhook, the customer's page kept counting toward a warehouse the box
 * had already left. */

const SRC = readFileSync(
  "src/routes/api/admin/orders/from-order-central/handover/+server.ts", "utf8");

describe("the handover endpoint", () => {
  it("is behind the bridge secret, like every Order Central route", () => {
    expect(SRC).toMatch(/checkBridgeSecret/);
    expect(SRC).toMatch(/status: 401/);
  });

  it("reuses the existing writer rather than a second copy of the rules", () => {
    /* advanceToHandedToCourier already sets the stage, the status, the
       progress, picked_up_at and the trail entry. A hand-rolled update
       here would drift from the webhook path the first time one changed. */
    expect(SRC).toMatch(/advanceToHandedToCourier/);
    /* The audit log records current_stage in its `after` block, which is
       a note about what happened rather than the thing that made it
       happen.
    
       The endpoint DOES update dropy_orders — for the courier's own
       delivery date, which advanceToHandedToCourier knows nothing about.
       What must not be here is a second copy of the STAGE rules: the
       stage, the status, the progress, picked_up_at and the trail entry
       all belong to that one writer. */
    const updates = SRC.match(/\.update\(\{[\s\S]{0,300}?\}\)/g) ?? [];
    for (const u of updates) {
      expect(u, "the handover must not set the stage itself").not.toMatch(/current_stage/);
      expect(u, "the handover must not set progress itself").not.toMatch(/progress/);
      expect(u, "the handover must not set picked_up_at itself").not.toMatch(/picked_up_at/);
    }
  });

  it("maps a carrier name onto the platform column", () => {
    /* Order Central sends "DTDC Surface" or "Amazon Transportation" —
       the CARRIER. last_mile_courier holds the PLATFORM it was booked
       through, and last-mile.ts builds its deep links per platform, so a
       carrier name stored there produces a link that goes nowhere. */
    expect(SRC).toMatch(/velocity\/i/);
    expect(SRC).toMatch(/shiprocket\/i/);
    expect(LAST_MILE_COURIERS).toEqual(["Shiprocket", "Velocity"]);
  });

  it("refuses a courier it cannot map, rather than storing a bad value", () => {
    expect(SRC).toMatch(/must be Shiprocket or Velocity/);
    expect(SRC).toMatch(/status: 400/);
  });

  it("treats an already-handed-over order as success", () => {
    /* Order Central writes the AWB to its own record BEFORE calling this,
       so a failure here gets retried. Answering with an error would make
       it retry something that has already happened. */
    expect(SRC).toMatch(/ok: true, advanced/);
  });

  it("does not claim the handover came from a webhook", () => {
    /* The default trail copy says "confirmed via webhook, ahead of the
       estimated schedule". For a booking made in Order Central that is
       simply untrue, and it is the line the customer reads. */
    expect(SRC).toMatch(/Handed to \$\{courier\} for the final leg/);
  });
});

/* ── cancelling and re-booking the India leg ──────────────────────
 *
 * Order Central can cancel an Indian shipment and book another — wrong
 * box, wrong courier, a pickup that never came. The parcel is still at
 * Vashi; only the booking was wrong.
 *
 * advanceToHandedToCourier returned early for ANY order already at
 * handed_to_courier, which is right for a webhook arriving twice and
 * wrong for a different AWB. The customer's page would have kept
 * pointing at a cancelled shipment on a courier that no longer had the
 * box, and nothing else would ever have corrected it — this is the only
 * writer of those columns. */

const ADV = readFileSync("src/lib/server/advance-to-courier.ts", "utf8");

describe("re-booking after a cancellation", () => {
  it("still no-ops when the same AWB arrives twice", () => {
    /* A webhook firing again must not rewrite the trail. */
    expect(ADV).toMatch(/sameAwb/);
    expect(ADV).toMatch(/if \(sameAwb\) return false/);
  });

  it("updates the columns when the AWB has changed", () => {
    expect(ADV).toMatch(/last_mile_awb: awb/);
    expect(ADV).toMatch(/last_mile_tracking_url: trackingUrl \?\? null/);
  });

  it("says so on the trail rather than swapping silently", () => {
    /* A customer who saw the first courier's name needs the line that
       replaces it. */
    expect(ADV).toMatch(/Re-booked with \$\{courier\}/);
  });

  it("reads the existing AWB, or it cannot tell the cases apart", () => {
    expect(ADV).toMatch(/select\("id, current_stage, route_key, timing_seed, items, last_mile_awb"\)/);
  });
});

/* ── a cancelled India leg ────────────────────────────────────────
 *
 * The parcel is back with us. Leaving the order at handed_to_courier
 * tells the customer it is with a courier who no longer has it, on an
 * AWB that no longer exists, and nothing else would ever correct it. */

const UNHAND = readFileSync(
  "src/routes/api/admin/orders/from-order-central/unhandover/+server.ts", "utf8");

describe("the unhandover endpoint", () => {
  it("is behind the bridge secret", () => {
    expect(UNHAND).toMatch(/checkBridgeSecret/);
    expect(UNHAND).toMatch(/status: 401/);
  });

  it("lands on qc_check, not back on the clock", () => {
    /* A tracking number was cut, which only happens with the box in
       front of someone. Resuming the estimate would place it somewhere
       over the Atlantic. */
    expect(UNHAND).toMatch(/const BACK = "qc_check"/);
  });

  it("only acts on an order that was actually handed over", () => {
    /* Dragging anything else to qc_check would invent an arrival. */
    expect(UNHAND).toMatch(/current_stage !== "handed_to_courier"/);
    expect(UNHAND).toMatch(/changed: false/);
  });

  it("clears the courier columns, including the dates", () => {
    for (const col of ["last_mile_courier", "last_mile_awb",
                       "last_mile_tracking_url", "last_mile_edd"]) {
      expect(UNHAND, `${col} not cleared`).toMatch(new RegExp(`${col}: null`));
    }
  });

  it("unsets picked_up_at, because the pickup was retracted", () => {
    /* Left set, it keeps the journey pinned to a moment that no longer
       happened. */
    expect(UNHAND).toMatch(/picked_up_at: null/);
  });

  it("removes the handover event rather than relabelling it", () => {
    /* It used to be kept, relabelled and pushed a second earlier. The
       line still read "Handed to courier" with a courier's name on it —
       and the heading is what a customer scans, so a parcel sitting at
       Vashi had the top of its timeline saying a courier had it.
    
       Nothing is lost: the retraction and its reason are in the admin
       audit trail, and re-shipping writes a fresh handover. */
    expect(UNHAND).toMatch(/\.delete\(\)\s*\n?\s*\.eq\("order_id", order\.id\)/);
    expect(UNHAND).not.toMatch(/Courier booking cancelled/);
  });
});

describe("the courier's own delivery date", () => {
  it("is stored when Order Central sends it", () => {
    expect(SRC).toMatch(/last_mile_edd: edd/);
    expect(SRC).toMatch(/last_mile_original_edd/);
  });

  it("parses a date rather than trusting the string", () => {
    expect(SRC).toMatch(/Number\.isFinite\(ms\)/);
  });
});

describe("the unhandover holds the parcel at the warehouse", () => {
  it("sets label_generated_at when clearing picked_up_at", () => {
    /* realEventStage reads picked_up_at, then label_generated_at, then
       lets the CLOCK decide. Clearing the pickup without setting this
       leaves both null, so a parcel two days into a twelve-day window is
       dragged back to somewhere over the Atlantic — the exact thing this
       endpoint exists to prevent. It survived only because these orders
       happen to carry no clock anchor. */
    expect(UNHAND).toMatch(/picked_up_at: null/);
    expect(UNHAND).toMatch(/label_generated_at: order\.label_generated_at \?\? ts/);
  });

  it("reads the existing value rather than overwriting it", () => {
    /* An order that genuinely generated a label earlier keeps that
       moment; only one that never had one gets now. */
    expect(UNHAND).toMatch(/label_generated_at, deleted_at/);
  });
});

describe("the unhandover leaves a readable trail", () => {
  it("writes no qc_check event of its own", () => {
    /* A real qc_check row becomes `lastReal`, and the synthetic backfill
       only draws stages BETWEEN the last real event and the live stage —
       so it leaves nothing between, and the customer loses Customs
       cleared and At arrival warehouse from a journey they had already
       watched. Traced on a real row. */
    expect(UNHAND).not.toMatch(/stage: BACK, label: "Checked and passed"/);
    expect(UNHAND).toMatch(/No qc_check event is written/);
  });

  it("leaves no handed_to_courier row behind to sort at all", () => {
    /* The old fix subtracted a second so the retracted handover would
       sort below the qc_check. That assumed a qc_check ROW — and there
       isn't one: it is synthetic, drawn by the backfill wherever the
       backfill puts it, not at `ts`. So the ordering never held and the
       handover rendered above the stage it rolled back to anyway.
    
       Deleting the row removes the question. */
    expect(UNHAND).not.toMatch(/Date\.parse\(ts\) - 1000/);
    expect(UNHAND).toMatch(/\.eq\("stage", "handed_to_courier"\)/);
  });
});

describe("what a customer sees after the booking is cancelled", () => {
  const UNHAND2 = readFileSync(
    "src/routes/api/admin/orders/from-order-central/unhandover/+server.ts", "utf8");

  it("never leaves a line claiming a courier has the parcel", () => {
    /* THE DEFECT. The heading is what a customer scans; the retracting
       note under it is not. A parcel at Vashi had the top of its
       timeline reading "Handed to courier — Shiprocket". */
    expect(UNHAND2).not.toMatch(/state: "done"/);
    expect(UNHAND2).toMatch(/\.delete\(\)/);
  });

  it("still records the retraction where staff can read it", () => {
    /* Deleting the customer-facing row is not losing the history. */
    expect(UNHAND2).toMatch(/logSystemAudit/);
    expect(UNHAND2).toMatch(/India leg cancelled/);
  });

  it("deletes every handover row, not just the newest", () => {
    /* Ship, cancel, reship, cancel: two rows. Updating evs[0] left the
       older one on the page forever. */
    expect(UNHAND2).not.toMatch(/evs\?\.\[0\]/);
    expect(UNHAND2).toMatch(/\.eq\("stage", "handed_to_courier"\)/);
  });
});
