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

describe("the bridge no longer accepts supersedes", () => {
  /* Removed 15 Sept with the spec change. Left in, it would be untested
     code nothing calls -- and the next person reading the endpoint would
     reasonably assume cancel still links forward. */
  it("does not resolve or write a superseded tracking", () => {
    expect(BRIDGE).not.toMatch(/body\.supersedes/);
    expect(BRIDGE).not.toMatch(/replacement_of:\s*supersedesId/);
  });
});

describe("the forward link is DAMAGED only", () => {
  /* Superseded: cancelling and then issuing a new tracking contradict
     each other. A cancelled parcel is still flying to Vashi -- there is
     nothing to replace. Replacements belong to damaged, where the box is
     gone. This file asserted the opposite until the spec changed on
     15 Sept; the tests went red, which is why they exist. */
  it("looks up successors for damaged", () => {
    expect(SERVICE).toMatch(/current_stage === "damaged"/);
  });

  it("picks the earliest successor deterministically", () => {
    expect(SERVICE).toMatch(/\.order\("id", \{ ascending: true \}\)/);
    expect(SERVICE).toMatch(/!replacementOf\.has\(key\)/);
  });

  it("does NOT offer a cancelled customer a new consignment", () => {
    expect(PAGE).not.toContain("Track the new consignment");
  });

  it("still offers a damaged customer their replacement", () => {
    expect(PAGE).toContain("Track the replacement");
  });
});

describe("cancelled keeps travelling; damaged does not", () => {
  const JOURNEY = readFileSync("src/lib/journey.ts", "utf8");

  it("caps a cancelled parcel at the Vashi warehouse", () => {
    // It is not going to a door, so the clock stops at the last place it
    // is actually going.
    expect(JOURNEY).toMatch(/CANCEL_CAP: StageKey = "at_vashi_warehouse"/);
    expect(JOURNEY).toMatch(/Math\.min\(live, cap\)/);
  });

  it("freezes a damaged parcel at the stage it had reached", () => {
    // held_at is what makes that answerable -- current_stage is
    // overwritten with the hold key, so the journey stage is otherwise
    // gone and the history cannot be replayed.
    expect(JOURNEY).toMatch(/FROZEN = new Set\(\["damaged"\]\)/);
    expect(JOURNEY).toMatch(/row\.held_at/);
    /* D1 split exception out of FROZEN. A delayed parcel is stopped,
       not ended: it resumes from where it stopped, so it pauses the
       clock instead of freezing the stage over a clock still running. */
    expect(JOURNEY).toMatch(/paused: true/);
    expect(JOURNEY).not.toMatch(/FROZEN\.has\("exception"\)/);
  });

  it("separates where the box got to from what we report", () => {
    // One variable drove both, which is why suppressing the stage for the
    // status also suppressed the timeline.
    expect(JOURNEY).toMatch(/journey: StageKey/);
    expect(JOURNEY).toMatch(/reported: string/);
    expect(SERVICE).toMatch(/stageToStatus\(view\.paused \? view\.journey : view\.reported\)/);
  });

  it("keeps the route and progress for a cancelled parcel, hides them for damaged", () => {
    expect(PAGE).toMatch(/\{#if !damaged && \(!cancelled \|\| shipment\.cancelledInFlight\)\}/);
    const guarded = PAGE.split("{#if !damaged && (!cancelled || shipment.cancelledInFlight)}")[1]
      ?.split("{/if}")[0] ?? "";
    expect(guarded).toContain("<Crossing");
    expect(guarded).toContain("progress={shipment.progress}");
  });

  it("keeps the arrival date on a cancelled parcel and drops it on a damaged one", () => {
    /* The box really is landing at Vashi on that date. Blanking it would
       be less true, not more careful.

       view.capped is deliberately absent from the blanking rule: a
       cancelled parcel is still flying to Vashi. view.closed is a
       different question — see the CLOSED block below — and is there
       because a parcel that already reached the warehouse has no
       arrival left to date. */
    expect(SERVICE).toMatch(/view\.frozen \|\| view\.paused \|\| view\.closed/);
    expect(SERVICE).not.toMatch(/eta: overdue \|\| view\.frozen \|\| view\.capped/);
  });

  it("never sends either one a doorstep date", () => {
    expect(SERVICE).toMatch(/doorstepEta:\s*\n?\s*overdue \|\| held \|\| view\.closed \?/);
  });
});

describe("DotConnects does not speak as if it were Dropy", () => {
  /* DotConnects is the forwarder; Dropy India is the consignee it
     delivers to — the same relationship Shiprocket and Velocity have to
     Dropy. Copy saying "our Mumbai warehouse" collapses two companies
     into one on a page the customer reaches from a Dropy order. */
  it("names the Dropy India warehouse rather than claiming it", () => {
    expect(PAGE).not.toMatch(/our Mumbai\s*\n?\s*warehouse/);
    expect(PAGE).toContain("the Dropy India warehouse in Mumbai");
    expect(PAGE).toContain("stops at the Dropy");
  });
});
