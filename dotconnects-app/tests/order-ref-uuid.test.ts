import { describe, it, expect } from "vitest";
import { byOrderRef } from "../src/lib/server/order-ref";
import { outOfScope } from "../src/lib/server/brand-scope";
import { fakeSupabase } from "./helpers/fake-supabase";

/* The admin panel addresses an order by its row id — a UUID. DOC
   addresses it by tracking id. Both must land on the right row. */

const rec = () => {
  const calls: any[] = [];
  const q: any = { eq: (...a: any[]) => (calls.push(["eq", ...a]), q), ilike: (...a: any[]) => (calls.push(["ilike", ...a]), q) };
  return { q, calls };
};

describe("byOrderRef", () => {
  it("a UUID (admin panel) matches the row id", () => {
    const { q, calls } = rec();
    byOrderRef(q, "3F2A9C1E-7B44-4D2A-9C0E-1A2B3C4D5E6F");
    expect(calls).toEqual([["eq", "id", "3f2a9c1e-7b44-4d2a-9c0e-1a2b3c4d5e6f"]]);
  });
  it("a tracking id (what DOC sends) is unchanged — case-insensitive tracking match", () => {
    for (const t of ["USLMVPDDHD89163447", "usLMT6V291D0045868", "IN-5473-1"]) {
      const { q, calls } = rec();
      byOrderRef(q, t);
      expect(calls).toEqual([["ilike", "tracking_id", t]]);
    }
  });
  it("digits still match a numeric id", () => {
    const { q, calls } = rec();
    byOrderRef(q, "42");
    expect(calls).toEqual([["eq", "id", 42]]);
  });
});

describe("a Rudra login opening its own order by its UUID", () => {
  it("is let through (this was the 'order not opening' bug)", async () => {
    const id = "3f2a9c1e-7b44-4d2a-9c0e-1a2b3c4d5e6f";
    const sb = fakeSupabase({ dropy_orders: (calls: any[]) => {
      const byId = calls.some((c) => c[1] === "eq" && c[2] === "id" && c[3] === id);
      return byId ? { id, brand: "rudra" } : null;
    } });
    const r = await outOfScope({ identity: { id: "u2", username: "rudra", role: "staff", brand: "rudra" } as any, supabase: sb.client }, id);
    expect(r).toBeNull();
  });
});
