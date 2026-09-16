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
       happen. What must NOT be here is a second update to the order. */
    expect(SRC).not.toMatch(/from\("dropy_orders"\)[\s\S]{0,200}?\.update\(/);
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
