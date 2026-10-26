import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { brandForHost, brandOrderNo, isBrandKey } from "../src/lib/brands";
import { brandHostAllows } from "../src/lib/server/brand-host";
import { checkTrackingUrl } from "../src/lib/server/tracking-url";
import { shareMessage } from "../src/lib/share-text";

describe("which host is a brand's admin door", () => {
  it("rudra. is Rudra, on the real domain and locally", () => {
    expect(brandForHost("rudra.dotconnectslogistics.com")).toBe("rudra");
    expect(brandForHost("RUDRA.dotconnectslogistics.com:443")).toBe("rudra");
    expect(brandForHost("rudra.localhost")).toBe("rudra");
  });
  it("every other host is the Dropy admin, exactly as before", () => {
    for (const h of ["track.dotconnectslogistics.com", "dotconnect-seven.vercel.app",
      "dotconnectslogistics.com", "localhost", "127.0.0.1", "", null, undefined,
      "rudra-preview.vercel.app", "notrudra.dotconnectslogistics.com"]) {
      expect(brandForHost(h as any)).toBeNull();
    }
  });
  it("only known brands are brands", () => {
    expect(isBrandKey("rudra")).toBe(true);
    for (const v of ["dropy", "Rudra", "", null, "toString", "__proto__"]) expect(isBrandKey(v)).toBe(false);
  });
});

describe("Rudra order number", () => {
  it("accepts the number however it was typed", () => {
    for (const v of ["1042", "#1042", " 1042 ", "Rudra-1042", "rudra 1042", "RUDRA_1042", "rudra1042"]) {
      expect(brandOrderNo("rudra", v)).toBe("Rudra-1042");
    }
  });
  it("refuses anything that isn't a number", () => {
    for (const v of ["", "abc", "Dropy-1042", "1042a", "10 42", "Rudra-", "#", "1234567890123"]) {
      expect(brandOrderNo("rudra", v)).toBeNull();
    }
  });
});

describe("the brand host serves the admin and nothing else", () => {
  it("allows admin pages and admin API", () => {
    for (const p of ["/admin", "/admin/", "/admin/new", "/admin/42", "/api/admin/login", "/api/admin/me",
      "/api/admin/logout", "/api/admin/orders", "/api/admin/orders/42", "/api/admin/orders/42/handover",
      "/api/admin/orders/create", "/_app/immutable/x.js", "/logo.png", "/favicon.ico"]) {
      expect(brandHostAllows(p), p).toBe(true);
    }
  });
  it("refuses customer pages, signed links, public lookups and the DOC bridge", () => {
    for (const p of ["/", "/t/ABC-xyz", "/c/ABC-xyz", "/tracking/ABC", "/api/track", "/api/status/ABC",
      "/api/status/order/Dropy-1", "/api/webhooks/courier-updates-a",
      "/api/admin/orders/from-order-central", "/api/admin/orders/from-order-central/handover",
      "/administrator", "/api/adminx"]) {
      expect(brandHostAllows(p), p).toBe(false);
    }
  });
});

describe("the pasted Indian tracking link", () => {
  it("takes a Velocity or Shiprocket https page with no warning", () => {
    for (const u of ["https://www.velocityshipping.in/track/81052817", "https://shiprocket.co/tracking/123456",
      "https://dotconnects.shiprocket.co/tracking/123"]) {
      const r = checkTrackingUrl(u);
      expect(r.url, u).toBeTruthy();
      expect(r.warning, u).toBeUndefined();
    }
  });
  it("takes another https courier page but warns", () => {
    const r = checkTrackingUrl("https://www.dtdc.in/tracking.asp?awb=I81052817");
    expect(r.url).toBeTruthy();
    expect(r.warning).toMatch(/dtdc\.in/);
  });
  it("refuses anything the customer shouldn't be redirected to", () => {
    for (const u of ["", "velocityshipping.in/track/1", "http://www.velocityshipping.in/track/1",
      "javascript:alert(1)", "data:text/html,hi", "https://user:pw@shiprocket.co/x", "ftp://x.y/z",
      "https://shiprocket.co/" + "a".repeat(600)]) {
      expect(checkTrackingUrl(u).url, u).toBeNull();
    }
  });
});

describe("the WhatsApp text", () => {
  const order = {
    customer_name: "Priya Sharma", dropy_order_id: "Rudra-1042", customer_city: "Pune",
    estimated_delivery: "12 Nov 2026", customer_mobile: "9876543210",
    items: JSON.stringify([{ name: "CeraVe Cream", qty: 2 }, { name: "Vitamin C", qty: 1 }]),
  };
  const link = "https://track.dotconnectslogistics.com/t/KQ7M2XNPA4810613-aem5qu5g73";
  const m = shareMessage(order, link);
  it("carries the order, items, ETA block and the link", () => {
    expect(m).toMatch(/^Hi Priya! 👋/);
    expect(m).toContain("Rudra-1042");
    expect(m).toContain("📦 CeraVe Cream × 2");
    expect(m).toContain("📦 Vitamin C × 1");
    expect(m).toContain("🏭 India Warehouse ETA: 12 Nov 2026");
    expect(m).toContain("📍 Delivering to: Pune");
    expect(m.trim().endsWith(link)).toBe(true);
  });
  it("one fact per line in the ETA block, never a paragraph", () => {
    const block = m.split("\n").filter((l) => /^(🌍|🏭|🚚|📍|🔔)/.test(l));
    expect(block).toHaveLength(5);
  });
  it("adds the doorstep date when there is one, and only then", () => {
    const withDoor = shareMessage({ ...order, order_date: "2026-10-21T06:30:00.000Z", shipping_days: 12, doorstep_days: 5 }, link);
    expect(withDoor).toMatch(/🏠 Expected at your door: \d{2} \w{3} \d{4}/);
    expect(m).not.toContain("🏠");
  });
  it("never contains the phone number or the admin host", () => {
    expect(m).not.toContain("9876543210");
    expect(m).not.toMatch(/rudra\.dotconnects/);
  });
});

/* Structural: every per-order admin route must either keep a brand login
   inside its own orders, or refuse brand logins outright. A new route
   that forgets both fails here, not in production. */
describe("every per-order admin route is brand-safe", () => {
  const root = "src/routes/api/admin/orders/[id]";
  const files = [join(root, "+server.ts"),
    ...readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory()).map((d) => join(root, d, "+server.ts"))];
  it("found the routes", () => expect(files.length).toBeGreaterThanOrEqual(10));
  for (const f of files) {
    it(f, () => {
      const src = readFileSync(f, "utf8");
      const scoped = /await outOfScope\(guard, params\.id\)/.test(src);
      const refused = /requireDropyTeam\(|requireAdmin\(/.test(src) && !/requireStaff(OrBridge)?\(/.test(src);
      expect(scoped || refused).toBe(true);
    });
  }
  it("enquiries refuse brand logins", () => {
    for (const f of ["src/routes/api/admin/queries/+server.ts", "src/routes/api/admin/queries/[id]/+server.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src).toMatch(/requireDropyTeam\(cookies\)/);
      expect(src).not.toMatch(/requireStaff\(/);
    }
  });
  it("the DOC bridge routes are untouched by brands", () => {
    const dir = "src/routes/api/admin/orders/from-order-central";
    const all = [join(dir, "+server.ts"), ...readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory()).map((d) => join(dir, d, "+server.ts"))];
    for (const f of all) expect(readFileSync(f, "utf8")).not.toMatch(/brand/i);
  });
});
