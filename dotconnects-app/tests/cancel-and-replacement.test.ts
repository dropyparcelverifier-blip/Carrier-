import { describe, it, expect, vi, beforeEach } from "vitest";

/* Cancelling a TRACKING, and pointing a damaged parcel's original link
   at its replacement. Cancelling an ORDER stays an admin action in
   Shopify -- nothing here touches the sale. */

const ROW = {
  id: 7, tracking_id: "RMT1", dropy_order_id: "Dropy-5154",
  current_stage: "mid_transit", status: "In Transit",
  delivered_at: null, deleted_at: null,
};

function fakeSupabase(row: any, sink: any) {
  /* insert() is here because cancel and damaged now write a row to the
     customer's trail as well as updating the order. The mock predates
     that and had no insert at all, so the first run of this after the
     change failed inside the endpoint rather than on an assertion --
     the MOCK was incomplete, not the code. Captured into sink so the
     trail entry is asserted rather than merely tolerated. */
  const q: any = {
    select: () => q, eq: () => q,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
    update: (patch: any) => { sink.patch = patch; return { eq: () => Promise.resolve({ error: null }) }; },
    insert: (values: any) => { (sink.inserted ??= []).push(values); return Promise.resolve({ error: null }); },
  };
  return { from: (table: string) => { sink.lastTable = table; return q; } };
}
const post = (mod: any, body: any) =>
  mod.POST({ cookies: {}, params: { id: "7" }, request: { json: async () => body } } as any);

describe("cancel a tracking", () => {
  let sink: any;
  const mount = (row: any) => {
    sink = {};
    vi.resetModules();
    vi.doMock("$lib/server/guards", () => ({
      requireStaff: async () => ({ ok: true, supabase: fakeSupabase(row, sink), identity: { id: 1, username: "jd" } }),

      requireStaffOrBridge: async () => ({ ok: true, supabase: fakeSupabase(row, sink), identity: { id: 1, username: "jd" } }),
    }));
    vi.doMock("$lib/server/audit", () => ({ logAudit: async () => {} }));
    return import("../src/routes/api/admin/orders/[id]/cancel/+server");
  };

  it("stops the parcel and says so in both columns", async () => {
    const mod = await mount(ROW);
    const body = await (await post(mod, { reason: "pushed by mistake" })).json();
    expect(body.current_stage).toBe("cancelled");
    expect(sink.patch).toEqual({ current_stage: "cancelled", status: "Cancelled" });

    /* The customer's timeline, not just the order row. Without this the
       tracking page's only update stayed "Booking confirmed -- Order
       confirmed." from the day the order was created, under a heading
       saying the order was cancelled. */
    const trail = (sink.inserted ?? []).find((v: any) => v.stage === "cancelled");
    expect(trail, "cancelling should write a trail entry").toBeTruthy();
    expect(trail.note).toBe("Order Cancelled by Vendor.");
    expect(trail.note).not.toContain("pushed by mistake");
  });

  it("requires a reason", async () => {
    const mod = await mount(ROW);
    expect((await post(mod, {})).status).toBe(400);
    expect(sink.patch).toBeUndefined();
  });

  it("refuses to cancel a parcel already delivered", async () => {
    const mod = await mount({ ...ROW, delivered_at: "2026-09-10T00:00:00.000Z" });
    const res = await post(mod, { reason: "customer changed their mind" });
    expect(res.status).toBe(409);
    expect(sink.patch).toBeUndefined();
  });

  it("won't cancel twice", async () => {
    const mod = await mount({ ...ROW, current_stage: "cancelled" });
    expect((await post(mod, { reason: "again" })).status).toBe(409);
  });

  it("keeps the row — a link the customer has must still answer", async () => {
    const mod = await mount(ROW);
    await post(mod, { reason: "wrong US id" });
    expect(sink.patch.deleted_at).toBeUndefined();
  });
});

describe("cancelled and damaged are hold states, not route points", () => {
  it("a cancelled parcel does not advance with the clock", async () => {
    const { effectiveOrderStage } = await import("../src/lib/order-routes");
    const old = new Date(Date.now() - 30 * 86_400_000).toISOString();
    expect(effectiveOrderStage("US15DTWO", "cancelled", old, 13, 1)).toBe("cancelled");
    expect(effectiveOrderStage("US15DTWO", "damaged", old, 13, 1)).toBe("damaged");
  });

  it("Cancelled is styled deliberately, not fallen through to a default", async () => {
    const { statusStyle } = await import("../src/lib/status");
    const cancelled = statusStyle("Cancelled" as any);
    const damaged = statusStyle("Damaged in transit" as any);
    expect(cancelled).toBeTruthy();
    /* Not alert-toned: nothing is wrong to act on, the journey simply
       ended. Rendering it like a damaged parcel would read as a problem. */
    expect(cancelled).not.toEqual(damaged);
  });

  it("a cancelled parcel is not counted as live", async () => {
    const { isLive } = await import("../src/lib/status");
    expect(isLive("Cancelled" as any)).toBe(false);
  });
});
