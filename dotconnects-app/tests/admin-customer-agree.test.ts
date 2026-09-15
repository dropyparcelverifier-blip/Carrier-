import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { journeyView } from "$lib/journey";

/* ═══════════════════════════════════════════════════
   D3. The clock guard was copied into five places. The findings doc on
   14 Sept warned that a rule copied five times would diverge a sixth —
   and it already had: the three admin readers guarded `exception` and
   `damaged`, never learned about `cancelled`, and knew nothing of
   held_at. So a damaged parcel showed fourteen green stages to staff and
   the truth to the customer, on the same row, at the same moment.

   These assert there is ONE rule, not five agreeing ones.
   ═══════════════════════════════════════════════════ */

const SRC = {
  customer: readFileSync("src/lib/server/shipment-service.ts", "utf8"),
  docFacing: readFileSync("src/lib/server/status-payload.ts", "utf8"),
  adminDetail: readFileSync("src/routes/admin/[id]/+page.svelte", "utf8"),
  adminList: readFileSync("src/routes/api/admin/orders/+server.ts", "utf8"),
  timeline: readFileSync("src/lib/components/StageTimeline.svelte", "utf8"),
};

describe("every reader uses the shared rule", () => {
  for (const [name, src] of Object.entries(SRC)) {
    it(`${name} calls journeyView`, () => {
      expect(src).toMatch(/journeyView\(/);
    });

    it(`${name} has no hand-rolled hold check`, () => {
      /* The shape that diverged: a local `held` boolean built from
         literal hold-key comparisons. Narrowed to that shape on purpose —
         a row FILTER (which rows are damaged?) and a render BRANCH (show
         the exception banner) both mention the same keys legitimately and
         neither decides where the clock stands. */
      const handRolled = /const held\s*=\s*\n?\s*row\.current_stage ===/;
      expect(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""))
        .not.toMatch(handRolled);
    });
  }
});

describe("the timeline can be told when the journey stopped", () => {
  it("StageTimeline takes heldAt", () => {
    expect(SRC.timeline).toMatch(/heldAt = null/);
  });

  it("and the admin page passes it", () => {
    expect(SRC.adminDetail).toMatch(/heldAt=\{order\.held_at\}/);
  });

  it("without it a damaged parcel replays to today", () => {
    // The actual mechanism behind the fourteen green stages.
    const row = {
      current_stage: "damaged", route_key: "US15DTHREE",
      order_date: new Date(Date.now() - 20 * 864e5).toISOString(),
      shipping_days: 12, timing_seed: 0,
    };
    const withoutHeldAt = journeyView(row);
    const withHeldAt = journeyView({
      ...row, held_at: new Date(Date.now() - 18 * 864e5).toISOString() });
    expect(withoutHeldAt.journey).toBe("order_placed");
    expect(withHeldAt.journey).not.toBe("order_placed");
    expect(withHeldAt.frozen).toBe(true);
  });
});

describe("D12 · a real event is never synthesised twice", () => {
  it("the backfill checks the database first", () => {
    // On a held parcel the journey stage is behind current_stage, so the
    // backfill runs and used to append a second "Order placed" beside
    // the real one — two booking lines a minute apart.
    expect(SRC.customer).toMatch(/alreadyReal = dbEvents\.some/);
    expect(SRC.customer).toMatch(/if \(!alreadyReal\) events\.push/);
  });
});

describe("D7 · the trail reads in the order things happened", () => {
  it("sorts by time, not by sort_order", () => {
    // sort_order 99 put a hold LAST, and the page renders newest-first —
    // so last became the bottom of the page.
    expect(SRC.customer).toMatch(/Date\.parse\(a\.happened_at\)/);
  });

  it("still uses sort_order to break ties", () => {
    // Backfilled stages can share a timestamp; without the tiebreak they
    // would order arbitrarily.
    expect(SRC.customer).toMatch(/return a\.sort_order - b\.sort_order/);
  });
});
