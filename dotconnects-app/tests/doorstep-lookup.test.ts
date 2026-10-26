import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* Doorstep days for a manual order come from Order Central, which holds
   the only Shiprocket login. DOT asks with the shared bridge secret and
   never calls Shiprocket itself. Never throws, never blocks an order. */

const env: Record<string, string> = {};
vi.mock("$env/dynamic/private", () => ({ env }));

describe("doorstep lookup via DOC", () => {
  let calls: { url: string; secret: string | null }[] = [];
  beforeEach(() => {
    calls = [];
    for (const k of Object.keys(env)) delete env[k];
    env.ORDER_CENTRAL_BRIDGE_SECRET = "bridge-s3cret";
  });
  afterEach(() => vi.unstubAllGlobals());

  const stub = (body: any, status = 200) =>
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: any) => {
      calls.push({ url: String(url), secret: init?.headers?.["x-bridge-secret"] ?? null });
      return new Response(JSON.stringify(body), { status });
    }));
  const load = () => import("../src/lib/server/doorstep");

  it("asks the live DOC endpoint with the bridge secret, and returns its number", async () => {
    stub({ doorstep_days: 5 });
    const { doorstepDaysFor } = await load();
    expect(await doorstepDaysFor({ pincode: "560096", weightKg: 0.1, cod: true, declaredInr: 2359 })).toBe(5);
    expect(calls).toHaveLength(1);
    const u = new URL(calls[0].url);
    expect(u.origin + u.pathname).toBe("https://doc-rebuilt.vercel.app/api/webhook/dot-doorstep");
    expect(Object.fromEntries(u.searchParams)).toEqual({ pincode: "560096", weight_kg: "0.5", cod: "1", value: "2359" });
    expect(calls[0].secret).toBe("bridge-s3cret");
  });
  it("never talks to Shiprocket", async () => {
    stub({ doorstep_days: 4 });
    const { doorstepDaysFor } = await load();
    await doorstepDaysFor({ pincode: "400001" });
    expect(calls.every((c) => !/shiprocket/i.test(c.url))).toBe(true);
  });
  it("ORDER_CENTRAL_URL overrides DOC's address", async () => {
    env.ORDER_CENTRAL_URL = "https://doc.example.com/";
    stub({ doorstep_days: 4 });
    const { doorstepDaysFor } = await load();
    await doorstepDaysFor({ pincode: "400001" });
    expect(calls[0].url.startsWith("https://doc.example.com/api/webhook/dot-doorstep?")).toBe(true);
  });
  it("no call at all without the secret or a valid pincode", async () => {
    stub({ doorstep_days: 5 });
    const { doorstepDaysFor } = await load();
    expect(await doorstepDaysFor({ pincode: "4000" })).toBeNull();
    expect(await doorstepDaysFor({ pincode: null })).toBeNull();
    delete env.ORDER_CENTRAL_BRIDGE_SECRET;
    const before = process.env.ORDER_CENTRAL_BRIDGE_SECRET;
    delete process.env.ORDER_CENTRAL_BRIDGE_SECRET;
    expect(await doorstepDaysFor({ pincode: "400001" })).toBeNull();
    if (before !== undefined) process.env.ORDER_CENTRAL_BRIDGE_SECRET = before;
    expect(calls).toEqual([]);
  });
  it("null when DOC has no figure, refuses, errors, sends junk, or is unreachable", async () => {
    const { doorstepDaysFor } = await load();
    for (const [body, status] of [[{ doorstep_days: null }, 200], [{ error: "Unauthorized" }, 401],
      [{ error: "x" }, 500], [{ doorstep_days: 99 }, 200], [{ doorstep_days: "abc" }, 200]] as const) {
      stub(body, status);
      const err = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(await doorstepDaysFor({ pincode: "400001" }), JSON.stringify(body)).toBeNull();
      err.mockRestore();
    }
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await doorstepDaysFor({ pincode: "400001" })).toBeNull();
    err.mockRestore();
  });
});

describe("manual create stores the doorstep days", () => {
  beforeEach(() => vi.resetModules());
  async function create(doorstep: number | null) {
    const inputs: any[] = [];
    vi.doMock("$lib/server/doorstep", () => ({ doorstepDaysFor: async () => doorstep }));
    vi.doMock("$lib/server/create-order", async () => {
      const real: any = await vi.importActual("../src/lib/server/create-order");
      return { validateNewOrder: real.validateNewOrder,
        insertNewOrder: async (i: any) => { inputs.push(i); return { order: { id: 1, tracking_id: "ABCDEFGH4810613", ...i } }; } };
    });
    const g = { ok: true, identity: { id: "u2", username: "rudra", role: "staff", brand: "rudra" }, supabase: {} };
    vi.doMock("$lib/server/guards", () => ({ requireStaff: async () => g }));
    vi.doMock("$lib/server/audit", () => ({ logAudit: async () => {} }));
    const { POST } = await import("../src/routes/api/admin/orders/create/+server");
    const res = await POST({ cookies: {}, request: new Request("http://x", { method: "POST", body: JSON.stringify({
      us_order_id: "114-0630835-9163447", dropy_order_id: "1066", customer_name: "Nandan Kumar",
      customer_mobile: "9535771757", customer_city: "Bengaluru", customer_pincode: "560096",
      shipping_days: 12, items: [{ name: "Eye drops", qty: 1, weight_g: 60 }] }) }) } as any);
    return { body: await res.json(), inputs };
  }
  it("puts the looked-up days on the order and reports them", async () => {
    const { body, inputs } = await create(5);
    expect(inputs[0].doorstep_days).toBe(5);
    expect(body.doorstepDays).toBe(5);
  });
  it("no figure → no doorstep_days, order still created", async () => {
    const { body, inputs } = await create(null);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].doorstep_days).toBeUndefined();
    expect(body.ok).toBe(true);
  });
});
