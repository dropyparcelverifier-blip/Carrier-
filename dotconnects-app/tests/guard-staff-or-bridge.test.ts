import { describe, it, expect, vi } from "vitest";

/* Mocks live in their own file: vi.doMock registrations made in one
   describe block leak into the next one within a file, which made these
   three pass or fail depending on the order they ran in. */
describe("one endpoint, two ways in", () => {
  /* DOC is a server calling a server: no session cookie. The alternative
     was a parallel set of bridge routes, and two implementations of
     "cancel this parcel" disagree eventually. */
  const mount = async (cookieIdentity: any, secretOk: boolean) => {
    vi.resetModules();
    vi.doMock("$lib/server/admin-session", () => ({
      requireAdminIdentity: async () => cookieIdentity,
    }));
    vi.doMock("$lib/server/bridge-auth", () => ({ checkBridgeSecret: () => secretOk }));
    vi.doMock("$lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
    return import("../src/lib/server/guards");
  };

  it("lets a signed-in teammate through", async () => {
    const { requireStaffOrBridge } = await mount({ id: "1", username: "jd", role: "staff" }, false);
    const g = await requireStaffOrBridge({} as any, new Request("http://x"));
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.identity.username).toBe("jd");
  });

  it("lets Order Central through on the bridge secret", async () => {
    const { requireStaffOrBridge } = await mount(null, true);
    const g = await requireStaffOrBridge({} as any, new Request("http://x"));
    expect(g.ok).toBe(true);
    // Named, so the audit row points at something rather than nobody.
    if (g.ok) expect(g.identity.username).toBe("Order Central (DOC)");
  });

  it("refuses anyone with neither", async () => {
    const { requireStaffOrBridge } = await mount(null, false);
    const g = await requireStaffOrBridge({} as any, new Request("http://x"));
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.response.status).toBe(401);
  });
});
