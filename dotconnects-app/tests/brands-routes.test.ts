import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeSupabase } from "./helpers/fake-supabase";

/* The routes with brands in them. The DOC tests here are the important
   ones: Order Central's calls must make exactly the queries they made
   before — no brand lookup, no brand in an insert. */

const BRIDGE = { id: null, username: "Order Central (DOC)", role: "admin" };   // no brand key at all
const JD = { id: "u1", username: "jd", role: "admin", brand: null };
const RUDRA = { id: "u2", username: "rudra", role: "staff", brand: "rudra" };

const dropyOrder = {
  id: 7, tracking_id: "TRAOJUFBB1910613", dropy_order_id: "Dropy-4251", brand: "dropy",
  customer_name: "Rahul Mehta", customer_mobile: "9876543210", customer_city: "Mumbai",
  current_stage: "us_customs_cleared", status: "In Transit", shipping_days: 12, shipping_mode: "Air Freight",
  order_date: "2026-10-20T00:00:00.000Z", items: [{ name: "Cream", qty: 1, weight_g: 500 }],
  payment_status: "Paid", deleted_at: null, delivered_at: null,
};
const rudraOrder = { ...dropyOrder, id: 9, tracking_id: "KQ7M2XNP4810613", dropy_order_id: "Rudra-1042", brand: "rudra" };

function mountGuards(identity: any, sb: any) {
  const g = { ok: true, identity, supabase: sb.client };
  vi.doMock("$lib/server/guards", () => ({
    requireStaff: async () => g, requireStaffOrBridge: async () => g,
    requireAdmin: async () => (identity?.brand ? { ok: false, response: new Response(null, { status: 403 }) } : g),
    requireDropyTeam: async () => (identity?.brand ? { ok: false, response: new Response(null, { status: 403 }) } : g),
  }));
  vi.doMock("$lib/server/audit", () => ({ logAudit: async () => {}, logSystemAudit: async () => {} }));
}

const post = (handler: any, id: string, body: unknown) =>
  handler({ cookies: {}, params: { id }, request: new Request("http://x", { method: "POST", body: JSON.stringify(body) }) });

const brandLookups = (calls: any[]) => calls.filter((c) => c[1] === "select" && c[2] === "id, brand");

describe("outOfScope", () => {
  beforeEach(() => vi.resetModules());
  it("does nothing — no query — for Order Central and the Dropy team", async () => {
    const { outOfScope } = await import("../src/lib/server/brand-scope");
    for (const identity of [BRIDGE, JD, undefined, null]) {
      const sb = fakeSupabase({ dropy_orders: dropyOrder });
      expect(await outOfScope({ identity: identity as any, supabase: sb.client }, "7")).toBeNull();
      expect(sb.calls).toEqual([]);
    }
  });
  it("404s a Rudra login on a Dropy order, and on a missing one", async () => {
    const { outOfScope } = await import("../src/lib/server/brand-scope");
    for (const row of [dropyOrder, null]) {
      const sb = fakeSupabase({ dropy_orders: row });
      const r = await outOfScope({ identity: RUDRA as any, supabase: sb.client }, "7");
      expect(r?.status).toBe(404);
    }
  });
  it("lets a Rudra login through on its own order", async () => {
    const { outOfScope } = await import("../src/lib/server/brand-scope");
    const sb = fakeSupabase({ dropy_orders: rudraOrder });
    expect(await outOfScope({ identity: RUDRA as any, supabase: sb.client }, "9")).toBeNull();
  });
});

describe("DOC's calls are unchanged", () => {
  beforeEach(() => vi.resetModules());
  for (const [route, body] of [
    ["cancel", { reason: "customer cancelled" }],
    ["add-days", { add_days: 2, reason: "customs" }],
    ["delay", { reason: "held at customs" }],
    ["edit", { reason: "fix", items: [{ name: "Cream", qty: 1, weight_g: 500 }] }],
    ["damaged", { note: "crushed" }],
  ] as const) {
    it(`${route}: no brand lookup on a bridge call`, async () => {
      const sb = fakeSupabase({ dropy_orders: dropyOrder, dropy_order_events: [] });
      mountGuards(BRIDGE, sb);
      const { POST } = await import(`../src/routes/api/admin/orders/[id]/${route}/+server`);
      await post(POST, "TRAOJUFBB1910613", body).catch(() => {});
      expect(brandLookups(sb.calls)).toEqual([]);
    });
  }

  it("a bridge-created order's insert has no brand field (the default applies)", async () => {
    vi.doMock("$lib/server/supabase-admin", () => ({}));
    const inserts: any[] = [];
    const sb = fakeSupabase({ dropy_order_events: [] }, {
      insertResult: (t, v) => { inserts.push([t, v]); return { data: [{ ...v, id: 1 }], error: null }; },
    });
    vi.doMock("$lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => sb.client }));
    const { insertNewOrder } = await import("../src/lib/server/create-order");
    await insertNewOrder({
      us_order_id: "113-4410023-4810613", dropy_order_id: "Dropy-5473-1", tracking_id: "ABCDEFGH4810613",
      customer_name: "A", customer_mobile: "9876543210", customer_city: "Pune", shipping_days: 12,
      shipping_mode: "Air Freight", payment_status: "Paid", items: [{ name: "x", qty: 1, weight_g: 100 }],
    }).catch(() => {});
    const order = inserts.find(([t]) => t === "dropy_orders")?.[1];
    expect(order).toBeTruthy();
    expect("brand" in order).toBe(false);
  });

  it("damaged on a Dropy order: replacement insert has no brand field", async () => {
    const inserted: any[] = [];
    vi.doMock("$lib/server/create-order", () => ({
      validateNewOrder: () => null,
      insertNewOrder: async (input: any) => { inserted.push(input); return { order: { id: 99, tracking_id: "NEW" } }; },
    }));
    const sb = fakeSupabase({ dropy_orders: dropyOrder });
    mountGuards(BRIDGE, sb);
    vi.doMock("$lib/server/hold-event", () => ({ recordHoldEvent: async () => {} }));
    const { POST } = await import("../src/routes/api/admin/orders/[id]/damaged/+server");
    await post(POST, "7", { replacement: { us_order_id: "114-0000000-0000001" } });
    expect(inserted).toHaveLength(1);
    expect("brand" in inserted[0]).toBe(false);
  });

  it("damaged on a Rudra order: the replacement stays Rudra's", async () => {
    const inserted: any[] = [];
    vi.doMock("$lib/server/create-order", () => ({
      validateNewOrder: () => null,
      insertNewOrder: async (input: any) => { inserted.push(input); return { order: { id: 99, tracking_id: "NEW" } }; },
    }));
    const sb = fakeSupabase({ dropy_orders: rudraOrder });
    mountGuards(RUDRA, sb);
    vi.doMock("$lib/server/hold-event", () => ({ recordHoldEvent: async () => {} }));
    const { POST } = await import("../src/routes/api/admin/orders/[id]/damaged/+server");
    await post(POST, "9", { replacement: { us_order_id: "114-0000000-0000001" } });
    expect(inserted[0].brand).toBe("rudra");
    expect(inserted[0].dropy_order_id).toBe("Rudra-1042-R1");
  });
});

describe("a Rudra login on a Dropy order gets 404 from every action", () => {
  beforeEach(() => vi.resetModules());
  for (const route of ["cancel", "add-days", "delay", "edit", "damaged", "handover"]) {
    it(route, async () => {
      const sb = fakeSupabase({ dropy_orders: dropyOrder });
      mountGuards(RUDRA, sb);
      const { POST } = await import(`../src/routes/api/admin/orders/[id]/${route}/+server`);
      const res = await post(POST, "7", { reason: "x", add_days: 1, items: [{ name: "a", qty: 1 }], courier: "Velocity", awb: "12345678", tracking_url: "https://shiprocket.co/tracking/1" });
      expect(res.status).toBe(404);
      // Nothing was written.
      expect(sb.calls.filter((c) => ["update", "insert", "delete"].includes(c[1]))).toEqual([]);
    });
  }
  it("the order detail too", async () => {
    const sb = fakeSupabase({ dropy_orders: dropyOrder, dropy_orders_sectioned: dropyOrder, dropy_order_events: [] });
    mountGuards(RUDRA, sb);
    const { GET } = await import("../src/routes/api/admin/orders/[id]/+server");
    const res = await GET({ cookies: {}, params: { id: "7" } } as any);
    expect(res.status).toBe(404);
  });
});

describe("order detail: the customer link", () => {
  beforeEach(() => vi.resetModules());
  it("is the signed track. link, with no phone and never the admin host", async () => {
    vi.doMock("$env/dynamic/private", () => ({ env: { TRACK_LINK_SECRET: "vector-secret" } }));
    const sb = fakeSupabase({ dropy_orders: rudraOrder, dropy_orders_sectioned: rudraOrder, dropy_order_events: [] });
    mountGuards(RUDRA, sb);
    const { GET } = await import("../src/routes/api/admin/orders/[id]/+server");
    const body = await (await GET({ cookies: {}, params: { id: "9" } } as any)).json();
    expect(body.trackLink).toMatch(/^https:\/\/track\.dotconnectslogistics\.com\/t\/KQ7M2XNP4810613-[a-z2-7]{10}$/);
    expect(body.trackLink).not.toContain("9876543210");
  });
});

describe("create", () => {
  beforeEach(() => vi.resetModules());
  async function create(identity: any, body: any) {
    vi.resetModules();
    const inputs: any[] = [];
    vi.doMock("$lib/server/create-order", async () => {
      const real: any = await vi.importActual("../src/lib/server/create-order");
      return { validateNewOrder: real.validateNewOrder,
        insertNewOrder: async (i: any) => { inputs.push(i); return { order: { id: 1, tracking_id: "ABCDEFGH4810613", ...i } }; } };
    });
    mountGuards(identity, fakeSupabase());
    const { POST } = await import("../src/routes/api/admin/orders/create/+server");
    const res = await POST({ cookies: {}, request: new Request("http://x", { method: "POST", body: JSON.stringify(body) }) } as any);
    return { res, inputs };
  }
  const form = {
    us_order_id: "113-4410023-4810613", customer_name: "Priya", customer_mobile: "9876543210",
    customer_city: "Pune", shipping_days: 12, items: [{ name: "Cream", qty: 1, weight_g: 500 }],
  };
  it("a Rudra login's order is Rudra-numbered and Rudra-branded", async () => {
    const { res, inputs } = await create(RUDRA, { ...form, dropy_order_id: "#1042" });
    expect(res.status).toBe(200);
    expect(inputs[0].dropy_order_id).toBe("Rudra-1042");
    expect(inputs[0].brand).toBe("rudra");
  });
  it("a Rudra login can't type a Dropy order number", async () => {
    const { res, inputs } = await create(RUDRA, { ...form, dropy_order_id: "Dropy-5473" });
    expect(res.status).toBe(400);
    expect(inputs).toEqual([]);
  });
  it("order date: a store date starts the clock that day (midday IST)", async () => {
    const d = new Date(Date.now() - 5 * 864e5 + 5.5 * 36e5).toISOString().slice(0, 10);
    const { res, inputs } = await create(RUDRA, { ...form, dropy_order_id: "1066", order_date: d });
    expect(res.status).toBe(200);
    expect(inputs[0].order_date).toBe(new Date(`${d}T12:00:00+05:30`).toISOString());
  });
  it("order date: blank = today, exactly as before (no order_date passed)", async () => {
    const { inputs } = await create(RUDRA, { ...form, dropy_order_id: "1066", order_date: "" });
    expect("order_date" in inputs[0]).toBe(false);
  });
  it("order date: future, too old, or junk is refused", async () => {
    const future = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    const old = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    for (const bad of [future, old, "21/10/2026", "yesterday"]) {
      const { res, inputs } = await create(RUDRA, { ...form, dropy_order_id: "1066", order_date: bad });
      expect(res.status, bad).toBe(400);
      expect(inputs).toEqual([]);
    }
  });
  it("payment: only values the database accepts; the old Paid/COD words are mapped", async () => {
    for (const [given, stored] of [["Fully Paid", "Fully Paid"], ["Paid", "Fully Paid"], ["COD", "Cash on Delivery"],
      ["Cash on Delivery", "Cash on Delivery"], ["", "Unpaid"], [undefined, "Unpaid"]] as const) {
      const { res, inputs } = await create(RUDRA, { ...form, dropy_order_id: "1066", payment_status: given });
      expect(res.status, String(given)).toBe(200);
      expect(inputs[0].payment_status, String(given)).toBe(stored);
    }
  });
  it("payment: anything else is a clear 400, never a raw constraint error", async () => {
    const { res, inputs } = await create(RUDRA, { ...form, dropy_order_id: "1066", payment_status: "Prepaid" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Payment must be one of/);
    expect(inputs).toEqual([]);
  });
  it("the Dropy team's manual form is unchanged — its id as typed, no brand", async () => {
    const { inputs } = await create(JD, { ...form, dropy_order_id: "Dropy-5473" });
    expect(inputs[0].dropy_order_id).toBe("Dropy-5473");
    expect("brand" in inputs[0]).toBe(false);
  });
});

describe("Shipped in India", () => {
  beforeEach(() => vi.resetModules());
  async function ship(order: any, identity: any, body: any) {
    const advanced: any[] = [];
    vi.doMock("$lib/server/advance-to-courier", () => ({
      advanceToHandedToCourier: async (...a: any[]) => { advanced.push(a.slice(1)); return true; },
    }));
    const sb = fakeSupabase({ dropy_orders: order });
    mountGuards(identity, sb);
    const { POST } = await import("../src/routes/api/admin/orders/[id]/handover/+server");
    const res = await post(POST, String(order.id), body);
    return { res, body: await res.json(), advanced, sb };
  }
  const good = { courier: "Velocity", awb: "81052817123", tracking_url: "https://www.velocityshipping.in/track/81052817123" };

  it("hands a Rudra order to the courier with the pasted link", async () => {
    const r = await ship(rudraOrder, RUDRA, good);
    expect(r.res.status).toBe(200);
    expect(r.advanced[0]).toEqual([9, "Velocity", "81052817123", good.tracking_url, expect.any(String)]);
    expect(r.body.warning).toBeNull();
  });
  it("refuses a Dropy order — DOC owns that India leg — even for JD", async () => {
    const r = await ship(dropyOrder, JD, good);
    expect(r.res.status).toBe(409);
    expect(r.advanced).toEqual([]);
  });
  it("refuses a non-https link", async () => {
    const r = await ship(rudraOrder, RUDRA, { ...good, tracking_url: "javascript:alert(1)" });
    expect(r.res.status).toBe(400);
    expect(r.advanced).toEqual([]);
  });
  it("refuses an unknown courier and a junk AWB", async () => {
    expect((await ship(rudraOrder, RUDRA, { ...good, courier: "DTDC" })).res.status).toBe(400);
    expect((await ship(rudraOrder, RUDRA, { ...good, awb: "<x>" })).res.status).toBe(400);
  });
  it("refuses a cancelled parcel", async () => {
    const r = await ship({ ...rudraOrder, current_stage: "cancelled" }, RUDRA, good);
    expect(r.res.status).toBe(409);
  });
  it("warns, but saves, a link that isn't Velocity or Shiprocket", async () => {
    const r = await ship(rudraOrder, RUDRA, { ...good, tracking_url: "https://www.dtdc.in/track?awb=1" });
    expect(r.res.status).toBe(200);
    expect(r.body.warning).toMatch(/dtdc/);
  });
});

describe("order list", () => {
  beforeEach(() => vi.resetModules());
  async function list(identity: any, qs = "") {
    vi.resetModules();
    const sb = fakeSupabase({ dropy_orders_sectioned: [] });
    mountGuards(identity, sb);
    const { GET } = await import("../src/routes/api/admin/orders/+server");
    await GET({ cookies: {}, url: new URL(`http://x/api/admin/orders${qs}`) } as any);
    return sb.calls.filter((c) => c[1] === "eq" && c[2] === "brand").map((c) => c[3]);
  }
  it("a Rudra login: every query (counts and rows) is Rudra-only", async () => {
    const eqs = await list(RUDRA, "?brand=dropy");
    expect(eqs.length).toBeGreaterThan(5);
    expect(new Set(eqs)).toEqual(new Set(["rudra"]));
  });
  it("the Dropy team: no brand filter unless asked", async () => {
    expect(await list(JD)).toEqual([]);
    expect(new Set(await list(JD, "?brand=rudra"))).toEqual(new Set(["rudra"]));
  });
});

describe("hooks on the brand host", () => {
  beforeEach(() => vi.resetModules());
  const run = async (url: string) => {
    const { handle } = await import("../src/hooks.server");
    const passed: string[] = [];
    const res = await handle({
      event: { url: new URL(url) } as any,
      resolve: async (e: any) => { passed.push(e.url.pathname); return new Response("ok"); },
    } as any);
    return { res, passed };
  };
  it("rudra. / goes to /admin", async () => {
    const { res } = await run("https://rudra.dotconnectslogistics.com/");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/admin");
  });
  it("rudra. never serves a customer link or the DOC bridge", async () => {
    for (const p of ["/t/KQ7M2XNP4810613-aaaaaaaaaa", "/c/KQ7M2XNP4810613-aaaaaaaaaa", "/api/track?q=1",
      "/api/admin/orders/from-order-central/handover"]) {
      const { res, passed } = await run(`https://rudra.dotconnectslogistics.com${p}`);
      expect(res.status, p).toBe(404);
      expect(passed).toEqual([]);
    }
  });
  it("rudra. serves the admin, marked noindex", async () => {
    const { res, passed } = await run("https://rudra.dotconnectslogistics.com/admin/9");
    expect(passed).toEqual(["/admin/9"]);
    expect(res.headers.get("x-robots-tag")).toMatch(/noindex/);
  });
  it("track. is untouched — everything passes straight through", async () => {
    for (const p of ["/", "/t/X-aaaaaaaaaa", "/c/X-aaaaaaaaaa", "/api/admin/orders/from-order-central", "/admin"]) {
      const { res, passed } = await run(`https://track.dotconnectslogistics.com${p}`);
      expect(passed).toEqual([p]);
      expect(res.headers.get("x-robots-tag")).toBeNull();
    }
  });
});

describe("users", () => {
  beforeEach(() => vi.resetModules());
  async function createUser(body: any) {
    const inserts: any[] = [];
    const sb = fakeSupabase({}, { insertResult: (_t, v) => { inserts.push(v); return { data: { id: "n", ...v }, error: null }; } });
    mountGuards(JD, sb);
    vi.doMock("$lib/server/password", () => ({ hashPassword: () => "h" }));
    const { POST } = await import("../src/routes/api/admin/users/+server");
    const res = await POST({ cookies: {}, request: new Request("http://x", { method: "POST", body: JSON.stringify(body) }) } as any);
    return { res, inserts };
  }
  const base = { username: "rudra.admin", full_name: "Rudra Admin", password: "0123456789" };
  it("a Rudra login is created as staff even if admin was asked for", async () => {
    const { inserts } = await createUser({ ...base, role: "admin", brand: "rudra" });
    expect(inserts[0]).toMatchObject({ brand: "rudra", role: "staff" });
  });
  it("a Dropy user's insert is unchanged — no brand field", async () => {
    const { inserts } = await createUser({ ...base, role: "admin" });
    expect(inserts[0].role).toBe("admin");
    expect("brand" in inserts[0]).toBe(false);
  });
  it("an unknown team is refused", async () => {
    const { res, inserts } = await createUser({ ...base, brand: "acme" });
    expect(res.status).toBe(400);
    expect(inserts).toEqual([]);
  });
  it("a Rudra login can't be promoted to admin", async () => {
    const sb = fakeSupabase({ admin_users: { id: "u2", username: "rudra", role: "staff", is_active: true, brand: "rudra" } });
    mountGuards(JD, sb);
    const { PATCH } = await import("../src/routes/api/admin/users/[id]/+server");
    const res = await PATCH({ cookies: {}, params: { id: "u2" }, request: new Request("http://x", { method: "PATCH", body: JSON.stringify({ role: "admin" }) }) } as any);
    expect(res.status).toBe(409);
    expect(sb.calls.filter((c) => c[1] === "update")).toEqual([]);
  });
});
