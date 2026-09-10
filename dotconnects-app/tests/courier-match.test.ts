import { describe, it, expect } from "vitest";
import { bareRef, canAdvance, findConsignments } from "../src/lib/server/courier-match";

/** Records the or() filter the query was built with. */
function fake(rows: unknown[]) {
  let captured = "";
  const q: Record<string, unknown> = {
    select: () => q,
    or: (f: string) => { captured = f; return q; },
    is: () => q,
    order: () => q,
    limit: async () => ({ data: rows }),
  };
  return { client: { from: () => q } as never, filter: () => captured };
}

describe("bareRef", () => {
  it("strips a leading # — Shiprocket sends one shape, we store another", () => {
    expect(bareRef("#Dropy-4251")).toBe("Dropy-4251");
    expect(bareRef("Dropy-4251")).toBe("Dropy-4251");
    expect(bareRef("  #Dropy-4251  ")).toBe("Dropy-4251");
  });
  it("survives nothing", () => {
    expect(bareRef(null)).toBe("");
    expect(bareRef(undefined)).toBe("");
  });
});

describe("findConsignments", () => {
  it("matches the base id AND its split children", async () => {
    const f = fake([]);
    await findConsignments(f.client, ["Dropy-4251"], "");
    expect(f.filter()).toContain("dropy_order_id.eq.Dropy-4251");
    expect(f.filter()).toContain("dropy_order_id.like.Dropy-4251-%");
    expect(f.filter()).toContain("tracking_id.eq.Dropy-4251");
  });

  it("normalises a # before building the filter", async () => {
    const f = fake([]);
    await findConsignments(f.client, ["#Dropy-4251"], "");
    expect(f.filter()).toContain("dropy_order_id.eq.Dropy-4251");
    expect(f.filter()).not.toContain("#");
  });

  it("includes the AWB when there is one, and omits it when there isn't", async () => {
    const a = fake([]); await findConsignments(a.client, ["X"], "78440029183");
    expect(a.filter()).toContain("last_mile_awb.eq.78440029183");
    const b = fake([]); await findConsignments(b.client, ["X"], "");
    expect(b.filter()).not.toContain("last_mile_awb");
  });

  it("drops a reference carrying PostgREST filter syntax", async () => {
    // A comma or a dot would reshape or() rather than fail.
    const f = fake([]);
    await findConsignments(f.client, ["Dropy,4251", "Dropy.4251", "Dropy-4251"], "");
    expect(f.filter()).toContain("Dropy-4251");
    expect(f.filter()).not.toContain("Dropy,4251");
    expect(f.filter()).not.toContain("Dropy.4251");
  });

  it("returns nothing rather than an unfiltered query when there is no reference", async () => {
    const f = fake([{ id: "should-not-be-reached" }]);
    expect(await findConsignments(f.client, ["", null as never], "")).toEqual([]);
  });

  it("deduplicates identical references", async () => {
    const f = fake([]);
    await findConsignments(f.client, ["Dropy-4251", "#Dropy-4251"], "");
    expect(f.filter().split("dropy_order_id.eq.Dropy-4251").length - 1).toBe(1);
  });
});

describe("canAdvance", () => {
  const row = (id: string) => ({ id, dropy_order_id: id, tracking_id: "T",
    current_stage: "mid_transit", picked_up_at: null });

  it("one consignment is unambiguous — that is the box", () => {
    expect(canAdvance([row("Dropy-4251")])).toBe(true);
  });

  it("a split is NOT advanced: the courier cannot say which parcel was in the box", () => {
    expect(canAdvance([row("Dropy-4251-1"), row("Dropy-4251-2")])).toBe(false);
  });

  it("no match advances nothing", () => {
    expect(canAdvance([])).toBe(false);
  });
});
