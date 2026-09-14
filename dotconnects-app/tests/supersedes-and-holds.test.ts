import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* ═══════════════════════════════════════════════════
   Two fixes that are only observable in the wiring, not in a pure
   function — so they are asserted against the source. A weaker check
   here is worse than none: the first version of each of these bugs
   shipped past a green build and a full suite.
   ═══════════════════════════════════════════════════ */

const BRIDGE = readFileSync(
  "src/routes/api/admin/orders/from-order-central/+server.ts", "utf8");
const PAGE = readFileSync("src/routes/+page.svelte", "utf8");
const SERVICE = readFileSync("src/lib/server/shipment-service.ts", "utf8");
const CREATE = readFileSync("src/lib/server/create-order.ts", "utf8");

describe("the bridge forwards every field create-order accepts", () => {
  /* The bridge builds NewOrderInput field by field. A field create-order
     accepts but the bridge never sets is discarded in silence — which is
     exactly what happened to doorstep_days: accepted at one end, never
     sent from the other, and nothing anywhere reported it. */
  it("passes doorstep_days through", () => {
    expect(CREATE, "create-order should accept doorstep_days").toContain("doorstep_days");
    expect(BRIDGE, "the bridge drops doorstep_days on the floor")
      .toMatch(/doorstep_days:\s*leg\.doorstep_days/);
  });
});

describe("a re-push after a cancellation links back", () => {
  it("accepts supersedes from DOC", () => {
    expect(BRIDGE).toMatch(/body\.supersedes/);
  });

  it("resolves it to a row id — replacement_of holds the id, not the tracking id", () => {
    // Writing the tracking id straight into replacement_of would insert
    // cleanly and match nothing on the way back out.
    expect(BRIDGE).toMatch(/\.eq\("tracking_id", supersedes\)/);
    expect(BRIDGE).toMatch(/replacement_of:\s*supersedesId/);
  });

  it("does not fail the push when supersedes matches nothing", () => {
    // A broken forward link is worth less than a shipment.
    expect(BRIDGE).toMatch(/supersedesId\s*=\s*prior\?\.id\s*\?\?\s*null/);
    expect(BRIDGE).toMatch(/if \(supersedesId\)/);
  });
});

describe("the forward link covers cancelled, not only damaged", () => {
  it("looks up successors for both hold states", () => {
    expect(SERVICE).toMatch(/current_stage === "damaged" \|\| r\.current_stage === "cancelled"/);
  });

  it("picks the earliest successor deterministically", () => {
    // One cancelled parcel's items can be re-pushed as several
    // consignments. Last-write-wins would send the customer wherever the
    // query happened to end.
    expect(SERVICE).toMatch(/\.order\("id", \{ ascending: true \}\)/);
    expect(SERVICE).toMatch(/!replacementOf\.has\(key\)/);
  });

  it("offers the cancelled customer the new consignment", () => {
    expect(PAGE).toContain("Track the new consignment");
  });
});

describe("a hold state shows no progress", () => {
  it("hides the route card on cancelled and damaged", () => {
    // The ETA card honoured "no date, no progress, no next step"; the
    // route card drew a flight path and a percentage regardless.
    expect(PAGE).toMatch(/\{#if !cancelled && !damaged\}/);
  });

  it("keeps the progress bar inside that guard", () => {
    // Asserting the guard exists is not enough — it has to be the thing
    // wrapping Crossing, or it guards nothing.
    const guarded = PAGE.split("{#if !cancelled && !damaged}")[1]?.split("{/if}")[0] ?? "";
    expect(guarded).toContain("<Crossing");
    expect(guarded).toContain("progress={shipment.progress}");
  });
});
