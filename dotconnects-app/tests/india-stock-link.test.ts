import { describe, it, expect } from "vitest";
import { GET } from "../src/routes/c/[code]/+server";
import { indiaStockDestination } from "../src/lib/server/india-stock-link";

/* A +server.ts may export ONLY request handlers (GET, POST…) — SvelteKit
   refuses the build otherwise — so the helper lives in $lib (dd04c59 failed
   on Vercel for exactly this). */
/* DOC Build 5d: an India-stock parcel's "Track parcel" button must land on
   the courier's own page — never on a DotConnects page. */
const go = async (code: string) => {
  const res = await (GET as any)({ params: { code } });
  return { status: res.status, to: res.headers.get("location") };
};

describe("/c/ for India-stock parcels", () => {
  it("Shiprocket → the Shiprocket tracking page", async () => {
    expect(await go("IS-SR-151234567890-abcdefghij")).toEqual({ status: 302, to: "https://shiprocket.co/tracking/151234567890" });
  });
  it("Velocity → the Velocity tracking page", async () => {
    expect(await go("IS-VL-D1234567890-abcdefghij")).toEqual({ status: 302, to: "https://www.velocityshipping.in/track/D1234567890" });
  });
  it("a damaged or unsigned code of this shape still goes to the courier, never to DOT", async () => {
    expect((await go("IS-SR-151234567890")).to).toBe("https://shiprocket.co/tracking/151234567890");
    expect((await go("is-vl-d1234567890-zz")).to).toBe("https://www.velocityshipping.in/track/D1234567890");
  });
  it("only the two courier platforms, only an AWB — nothing else can be redirected", () => {
    expect(indiaStockDestination("IS-XX-123456")).toBeNull();
    expect(indiaStockDestination("IS-SR-../evil")).toBeNull();
    expect(indiaStockDestination("IS-SR-https://evil.com")).toBeNull();
    expect(indiaStockDestination("USLMT6V291D0045868-abcdefghij")).toBeNull();
  });
});

describe("/c/ route file exports only request handlers (the dd04c59 build failure)", () => {
  it("nothing but GET is exported", async () => {
    const mod = await import("../src/routes/c/[code]/+server");
    expect(Object.keys(mod).sort()).toEqual(["GET"]);
  });
});
