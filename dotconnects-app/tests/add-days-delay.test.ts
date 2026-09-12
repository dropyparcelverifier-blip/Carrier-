import { describe, it, expect, vi, beforeEach } from "vitest";
import { calendarDays } from "../src/lib/dates";

/* Extending a window and flagging a hold. Both endpoints existed on the
   bridge, reachable only with the bridge secret and called by nothing.
   The one that matters most here: estimated_delivery is a STORED STRING
   the customer page reads directly, so moving shipping_days without it
   leaves the customer on the old date while every stage stretches. */

const ROW = {
  id: 7, tracking_id: "RMT1", shipping_days: 13, status: "In Transit",
  order_date: "2026-09-01T00:00:00.000Z", current_stage: "mid_transit",
  route_key: "US15DTWO", timing_seed: 4251, deleted_at: null,
};

function fakeSupabase(row: any, sink: any) {
  const q: any = {
    select: () => q,
    eq: () => q,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
    update: (patch: any) => { sink.patch = patch; return { eq: () => Promise.resolve({ error: null }) }; },
  };
  return { from: () => q };
}

const post = (mod: any, body: any) =>
  mod.POST({ cookies: {}, params: { id: "7" }, request: { json: async () => body } } as any);

describe("add-days", () => {
  let sink: any;
  beforeEach(() => {
    sink = {};
    vi.resetModules();
    vi.doMock("$lib/server/guards", () => ({
      requireStaff: async () => ({ ok: true, supabase: fakeSupabase(ROW, sink), identity: { id: 1, username: "jd" } }),
    }));
    vi.doMock("$lib/server/audit", () => ({ logAudit: async () => {} }));
  });

  it("moves the STORED eta, not just shipping_days", async () => {
    const mod = await import("../src/routes/api/admin/orders/[id]/add-days/+server");
    const body = await (await post(mod, { add_days: 3, reason: "customs backlog" })).json();
    expect(body.shipping_days).toBe(16);
    expect(sink.patch.shipping_days).toBe(16);
    // The bug being guarded: this must be in the same update.
    expect(sink.patch.estimated_delivery).toBeTruthy();
    const expected = new Date(ROW.order_date);
    expected.setDate(expected.getDate() + calendarDays(16));
    expect(sink.patch.estimated_delivery).toBe(
      expected.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }));
  });

  it("reports both ETAs so the change can be seen", async () => {
    const mod = await import("../src/routes/api/admin/orders/[id]/add-days/+server");
    const body = await (await post(mod, { add_days: 3, reason: "backlog" })).json();
    expect(new Date(body.eta_after).getTime()).toBeGreaterThan(new Date(body.eta_before).getTime());
    expect(body.previous_days).toBe(13);
  });

  it("shortens as well as extends", async () => {
    const mod = await import("../src/routes/api/admin/orders/[id]/add-days/+server");
    expect((await (await post(mod, { add_days: -2, reason: "moved faster" })).json()).shipping_days).toBe(11);
  });

  it("refuses to pass the 30-day ceiling", async () => {
    const mod = await import("../src/routes/api/admin/orders/[id]/add-days/+server");
    const res = await post(mod, { add_days: 20, reason: "x" });
    expect(res.status).toBe(400);
    expect(sink.patch).toBeUndefined();
  });

  it("requires a reason — the date the customer saw is changing", async () => {
    const mod = await import("../src/routes/api/admin/orders/[id]/add-days/+server");
    expect((await post(mod, { add_days: 3 })).status).toBe(400);
    expect(sink.patch).toBeUndefined();
  });

  it("refuses a no-op and a fraction", async () => {
    const mod = await import("../src/routes/api/admin/orders/[id]/add-days/+server");
    expect((await post(mod, { add_days: 0, reason: "x" })).status).toBe(400);
    expect((await post(mod, { add_days: 1.5, reason: "x" })).status).toBe(400);
  });
});

describe("delay", () => {
  let sink: any;
  const mount = (row: any) => {
    sink = {};
    vi.resetModules();
    vi.doMock("$lib/server/guards", () => ({
      requireStaff: async () => ({ ok: true, supabase: fakeSupabase(row, sink), identity: { id: 1, username: "jd" } }),
    }));
    vi.doMock("$lib/server/audit", () => ({ logAudit: async () => {} }));
    return import("../src/routes/api/admin/orders/[id]/delay/+server");
  };

  it("flags a moving parcel as held", async () => {
    const mod = await mount(ROW);
    const body = await (await post(mod, { reason: "stuck at Delhi customs" })).json();
    expect(body.current_stage).toBe("exception");
    expect(sink.patch.current_stage).toBe("exception");
  });

  it("requires a reason to flag", async () => {
    const mod = await mount(ROW);
    expect((await post(mod, {})).status).toBe(400);
    expect(sink.patch).toBeUndefined();
  });

  it("clearing returns it to a REAL stage, not a made-up one", async () => {
    const { STAGES } = await import("../src/lib/types");
    const mod = await mount({ ...ROW, current_stage: "exception" });
    const body = await (await post(mod, { clear: true })).json();
    expect(STAGES.some((s: any) => s.key === body.current_stage)).toBe(true);
    expect(body.current_stage).not.toBe("exception");
  });

  it("won't clear an order that isn't held, or double-flag one that is", async () => {
    let mod = await mount(ROW);
    expect((await post(mod, { clear: true })).status).toBe(409);
    mod = await mount({ ...ROW, current_stage: "exception" });
    expect((await post(mod, { reason: "again" })).status).toBe(409);
  });
});
