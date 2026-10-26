import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeSupabase } from "./helpers/fake-supabase";

/* The host lock. A Rudra login works only at rudra., a Dropy login never
   works there, and a Rudra login is never an admin. */

const users: Record<string, any> = {
  jd: { id: "u1", username: "jd", role: "admin", is_active: true, password_hash: "ok", brand: null },
  rudra: { id: "u2", username: "rudra", role: "staff", is_active: true, password_hash: "ok", brand: "rudra" },
  sneaky: { id: "u3", username: "sneaky", role: "admin", is_active: true, password_hash: "ok", brand: "rudra" },
  weird: { id: "u4", username: "weird", role: "staff", is_active: true, password_hash: "ok", brand: "acme" },
  legacy: { id: "u5", username: "legacy", role: "admin", is_active: true, password_hash: "ok" }, // no brand column yet
};

function mountSession(host: string | null, username: string) {
  vi.resetModules();
  vi.doMock("$lib/server/request-host", () => ({ currentHost: () => host }));
  vi.doMock("$env/dynamic/private", () => ({ env: { ADMIN_SESSION_SECRET: "s" } }));
  const sb = fakeSupabase({ admin_users: () => users[username] ?? null });
  vi.doMock("$lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => sb.client }));
  return import("../src/lib/server/admin-session");
}

async function identityFor(host: string | null, username: string) {
  const mod = await mountSession(host, username);
  // A cookie jar holding a genuinely signed session for `username`.
  const jar: Record<string, string> = {};
  const cookies: any = { set: (k: string, v: string) => (jar[k] = v), get: (k: string) => jar[k], delete: () => {} };
  mod.createAdminSession(cookies, username);
  return mod.requireAdminIdentity(cookies);
}

describe("session: which login works on which host", () => {
  beforeEach(() => vi.resetModules());

  it("Dropy login on track. — unchanged: admin, no brand", async () => {
    const id = await identityFor("track.dotconnectslogistics.com", "jd");
    expect(id).toMatchObject({ username: "jd", role: "admin", brand: null });
  });
  it("a row from before the brand column existed is still a Dropy login", async () => {
    const id = await identityFor("track.dotconnectslogistics.com", "legacy");
    expect(id).toMatchObject({ role: "admin", brand: null });
  });
  it("Rudra login on rudra. — staff, brand rudra", async () => {
    const id = await identityFor("rudra.dotconnectslogistics.com", "rudra");
    expect(id).toMatchObject({ username: "rudra", role: "staff", brand: "rudra" });
  });
  it("Rudra login on track. — refused", async () => {
    expect(await identityFor("track.dotconnectslogistics.com", "rudra")).toBeNull();
  });
  it("Dropy login on rudra. — refused", async () => {
    expect(await identityFor("rudra.dotconnectslogistics.com", "jd")).toBeNull();
  });
  it("a Rudra row marked admin is still only staff", async () => {
    const id = await identityFor("rudra.dotconnectslogistics.com", "sneaky");
    expect(id?.role).toBe("staff");
  });
  it("an unknown brand value fails closed on every host", async () => {
    expect(await identityFor("track.dotconnectslogistics.com", "weird")).toBeNull();
    expect(await identityFor("rudra.dotconnectslogistics.com", "weird")).toBeNull();
  });
});

describe("login: refuses the wrong host with the generic message", () => {
  async function login(host: string, username: string) {
    vi.resetModules();
    vi.doMock("$env/dynamic/private", () => ({ env: { ADMIN_SESSION_SECRET: "s" } }));
    const sb = fakeSupabase({ admin_users: () => users[username] ?? null });
    vi.doMock("$lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => sb.client }));
    vi.doMock("$lib/server/password", () => ({ verifyPassword: (p: string, h: string) => p === "pw" && h === "ok" }));
    const created: string[] = [];
    vi.doMock("$lib/server/admin-session", () => ({ createAdminSession: (_c: any, u: string) => created.push(u) }));
    const { POST } = await import("../src/routes/api/admin/login/+server");
    const res = await POST({
      request: new Request(`https://${host}/api/admin/login`, { method: "POST", body: JSON.stringify({ username, password: "pw" }) }),
      cookies: {}, url: new URL(`https://${host}/api/admin/login`),
    } as any);
    return { body: await res.json(), created };
  }

  it("Dropy login on track. works", async () => {
    const r = await login("track.dotconnectslogistics.com", "jd");
    expect(r.body.ok).toBe(true);
    expect(r.created).toEqual(["jd"]);
  });
  it("Rudra login on rudra. works", async () => {
    const r = await login("rudra.dotconnectslogistics.com", "rudra");
    expect(r.body.ok).toBe(true);
  });
  it("Rudra login on track. is refused, no session", async () => {
    const r = await login("track.dotconnectslogistics.com", "rudra");
    expect(r.body).toEqual({ ok: false, error: "Invalid username or password" });
    expect(r.created).toEqual([]);
  });
  it("Dropy login on rudra. is refused, no session", async () => {
    const r = await login("rudra.dotconnectslogistics.com", "jd");
    expect(r.body.ok).toBe(false);
    expect(r.created).toEqual([]);
  });
});

describe("guards: a brand login is never admin and never on Dropy-only screens", () => {
  async function mount(identity: any) {
    vi.resetModules();
    vi.doMock("$lib/server/admin-session", () => ({ requireAdminIdentity: async () => identity }));
    vi.doMock("$lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));
    vi.doMock("$lib/server/bridge-auth", () => ({ checkBridgeSecret: () => false }));
    return import("../src/lib/server/guards");
  }
  const rudra = { id: "u2", username: "rudra", role: "admin", brand: "rudra" };
  const jd = { id: "u1", username: "jd", role: "admin", brand: null };

  it("requireAdmin refuses a brand login even with role admin", async () => {
    const g = await (await mount(rudra)).requireAdmin({} as any);
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.response.status).toBe(403);
  });
  it("requireAdmin still lets JD through", async () => {
    expect((await (await mount(jd)).requireAdmin({} as any)).ok).toBe(true);
  });
  it("requireDropyTeam refuses a brand login, lets the Dropy team through", async () => {
    expect((await (await mount(rudra)).requireDropyTeam({} as any)).ok).toBe(false);
    expect((await (await mount({ ...jd, role: "staff" })).requireDropyTeam({} as any)).ok).toBe(true);
  });
});
