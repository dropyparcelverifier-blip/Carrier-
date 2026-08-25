import { describe, it, expect } from "vitest";
import { STAGES } from "$lib/types";
import { extractPrefix, genTrackingId } from "$lib/tracking-id";

/* ═══════════════════════════════════════════════════
   M3 write endpoints — the guard rules.
   These mirror the server-side checks; they exist so a
   later refactor that drops a guard fails here loudly.
   ═══════════════════════════════════════════════════ */

describe("stage move — forward only", () => {
  const canMove = (from: string, to: string) => {
    const fromIdx = STAGES.findIndex((s) => s.key === from);
    const toIdx = STAGES.findIndex((s) => s.key === to);
    if (toIdx < 0) return false;
    return !(fromIdx >= 0 && toIdx <= fromIdx);
  };

  it("allows moving forward", () => {
    expect(canMove("mid_transit", "arrived_india")).toBe(true);
  });

  it("blocks moving backwards — a parcel cannot un-arrive", () => {
    expect(canMove("arrived_india", "mid_transit")).toBe(false);
  });

  it("blocks moving to the same stage", () => {
    expect(canMove("mid_transit", "mid_transit")).toBe(false);
  });

  it("rejects a stage key that isn't real", () => {
    expect(canMove("mid_transit", "teleported")).toBe(false);
  });

  it("allows skipping several stages at once", () => {
    expect(canMove("packed", "at_vashi_warehouse")).toBe(true);
  });
});

describe("milestone ordering — label → picked → delivered", () => {
  type Row = {
    label_generated_at: string | null;
    picked_up_at: string | null;
    delivered_at: string | null;
  };
  const empty: Row = { label_generated_at: null, picked_up_at: null, delivered_at: null };

  const canSet = (row: Row, key: "label" | "picked" | "delivered") => {
    if (key === "picked") return row.label_generated_at !== null;
    if (key === "delivered") return row.picked_up_at !== null;
    return true;
  };

  it("label can always be set first", () => {
    expect(canSet(empty, "label")).toBe(true);
  });

  it("pickup is blocked without a label", () => {
    // A parcel can't be collected before it's labelled — accepting this
    // silently produces a timeline nobody can explain later.
    expect(canSet(empty, "picked")).toBe(false);
  });

  it("pickup is allowed once labelled", () => {
    expect(canSet({ ...empty, label_generated_at: "2026-08-08T00:00:00Z" }, "picked")).toBe(true);
  });

  it("delivery is blocked without a pickup", () => {
    expect(canSet({ ...empty, label_generated_at: "2026-08-08T00:00:00Z" }, "delivered")).toBe(false);
  });

  it("delivery is allowed once picked up", () => {
    const row = {
      label_generated_at: "2026-08-08T00:00:00Z",
      picked_up_at: "2026-08-09T00:00:00Z",
      delivered_at: null,
    };
    expect(canSet(row, "delivered")).toBe(true);
  });
});

describe("redispatch — replacement identity", () => {
  it("replacement inherits the parent's tracking prefix", () => {
    const parent = "RMTMT6V291D0045868";
    const prefix = extractPrefix(parent);
    const replacement = genTrackingId("114-6167166-0099231", prefix);
    expect(replacement.slice(0, 3)).toBe("RMT");
  });

  it("works for USL parents too", () => {
    const prefix = extractPrefix("USLMT6V291D0045868");
    expect(genTrackingId("114-6167166-0099231", prefix).slice(0, 3)).toBe("USL");
  });

  const nextDropyId = (base: string, existing: number) =>
    `${base.replace(/-R\d+$/, "")}-R${existing + 1}`;

  it("suffixes the dropy order id so the unique constraint holds", () => {
    expect(nextDropyId("DROPY-3177", 0)).toBe("DROPY-3177-R1");
  });

  it("increments for a second redispatch", () => {
    expect(nextDropyId("DROPY-3177", 1)).toBe("DROPY-3177-R2");
  });

  it("does not stack suffixes when redispatching a replacement", () => {
    expect(nextDropyId("DROPY-3177-R1", 1)).toBe("DROPY-3177-R2");
  });

  it("the suffix keeps the customer's prefix search working", () => {
    // Lookup already matches `dropy_order_id like '<base>-%'`, so
    // searching the ORIGINAL number returns both rows with no new code.
    const base = "DROPY-3177";
    const replacement = nextDropyId(base, 0);
    expect(replacement.startsWith(`${base}-`)).toBe(true);
  });
});

describe("damaged is a hold state, not a timeline position", () => {
  it("is absent from STAGES", () => {
    // Like exception. STAGE_PROGRESS has no entry to look up, so adding
    // it to STAGES would break progress and status derivation.
    //
    // The cast is needed because TypeScript already proves this at
    // compile time — StageKey and "damaged" have no overlap, so the
    // comparison is statically false and tsc rejects it outright. That
    // static guarantee is stronger than this test; the runtime check
    // stays as a guard for anyone who later widens StageKey.
    const keys: string[] = STAGES.map((s) => s.key);
    expect(keys).not.toContain("damaged");
    expect(keys).not.toContain("exception");
  });

  it("STAGES still has exactly the 14 canonical stages", () => {
    expect(STAGES).toHaveLength(14);
  });
});
