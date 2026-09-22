import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$env/dynamic/private", () => ({ env: { TRACK_LINK_SECRET: "vector-secret" } }));
const search = vi.fn();
vi.mock("$lib/server/shipment-service", () => ({ searchShipments: (...a: unknown[]) => search(...a) }));
const lastMile = { url: "" as string | null };
vi.mock("$lib/server/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => {
      const q: any = { select: () => q, ilike: () => q, is: () => q, limit: () => q,
        maybeSingle: async () => ({ data: { last_mile_tracking_url: lastMile.url }, error: null }) };
      return q;
    },
  }),
}));

import { signTrackCode, verifyTrackCode, VECTOR } from "$lib/server/track-link";
import { GET as track } from "../src/routes/api/track/+server";
import { GET as courier } from "../src/routes/c/[code]/+server";
import { GET as shortLink } from "../src/routes/t/[code]/+server";

/** The same known answer is pinned in Order Central's tests/track-link.test.js. */
const VECTOR_CODE = "USLMT6V291D0045868-aem5qu5g73";

describe("signed tracking codes", () => {
  it("matches the shared known answer (Order Central pins the same one)", () => {
    expect(signTrackCode(VECTOR.id, VECTOR.secret)).toBe(VECTOR_CODE);
  });
  it("is URL-safe for a Meta button: letters, digits and one hyphen", () => {
    expect(VECTOR_CODE).toMatch(/^[A-Z0-9]+-[a-z2-7]{10}$/);
  });
  it("round-trips, and tolerates the case being changed by a phone", () => {
    expect(verifyTrackCode(VECTOR_CODE, VECTOR.secret)).toBe(VECTOR.id);
    expect(verifyTrackCode(VECTOR_CODE.toLowerCase(), VECTOR.secret)).toBe(VECTOR.id);
  });
  it("refuses an edited id, an edited signature, a wrong secret and junk", () => {
    expect(verifyTrackCode(VECTOR_CODE.replace("0045868", "0045869"), VECTOR.secret)).toBeNull();
    expect(verifyTrackCode(VECTOR_CODE.slice(0, -1) + "a", VECTOR.secret)).toBeNull();
    expect(verifyTrackCode(VECTOR_CODE, "other-secret")).toBeNull();
    for (const junk of ["", "-", "USLMT6V291D0045868", "x-aem5qu5g73", "USLMT6V291D0045868-!!!!!!!!!!"]) {
      expect(verifyTrackCode(junk, VECTOR.secret)).toBeNull();
    }
  });
  it("makes nothing without a secret, so a missing env var can't mint open links", () => {
    expect(signTrackCode(VECTOR.id, "")).toBe("");
    expect(verifyTrackCode(VECTOR_CODE, "")).toBeNull();
  });
});

const req = (qs: string, ip = "1.1.1.1") =>
  ({ url: new URL(`https://track.test/api/track?${qs}`), getClientAddress: () => ip }) as any;

describe("/api/track?t=<code>", () => {
  beforeEach(() => search.mockReset());

  it("opens the card with no phone typed, and the card carries no phone", async () => {
    search.mockResolvedValue({ source: "supabase", shipments: [
      { id: "USLMT6V291D0045868", customerMobile: "9876543210", customerName: "Priya" },
      { id: "USLMT6V291D0045868-2", customerMobile: "9876543210" },
    ] });
    const res = await track(req(`t=${VECTOR_CODE}`));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.shipments).toHaveLength(1);
    expect(body.shipments[0].id).toBe("USLMT6V291D0045868");
    expect(body.shipments[0]).not.toHaveProperty("customerMobile");
    expect(JSON.stringify(body)).not.toContain("9876543210");
  });

  it("gives a replacement parcel its own signed code", async () => {
    search.mockResolvedValue({ source: "supabase", shipments: [
      { id: "USLMT6V291D0045868", customerMobile: "9876543210", replacedByTrackingId: "RMTMT7AAAAA0045868" },
    ] });
    const body = await (await track(req(`t=${VECTOR_CODE}`, "2.2.2.2"))).json();
    expect(verifyTrackCode(body.shipments[0].replacedByCode, "vector-secret")).toBe("RMTMT7AAAAA0045868");
  });

  it("an edited code gets 'not valid' and never reaches the database", async () => {
    const res = await track(req(`t=${VECTOR_CODE.replace("0045868", "0045869")}`, "3.3.3.3"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/isn't valid/);
    expect(search).not.toHaveBeenCalled();
  });

  it("without t, the phone is still required", async () => {
    const res = await track(req("q=USLMT6V291D0045868", "4.4.4.4"));
    expect(res.status).toBe(400);
  });
});

describe("/t and /c", () => {
  it("/t/<code> hands the code to the tracking page, not indexed", async () => {
    const res = await shortLink({ params: { code: VECTOR_CODE } } as any);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/?t=${VECTOR_CODE}`);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });
  it("/c/<code> goes to the courier's own stored page", async () => {
    lastMile.url = "https://www.dtdc.in/track?awb=D123";
    const res = await courier({ params: { code: VECTOR_CODE } } as any);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://www.dtdc.in/track?awb=D123");
  });
  it("/c/<code> with no courier yet, a non-http value, or a bad code → our page", async () => {
    for (const url of [null, "", "javascript:alert(1)"]) {
      lastMile.url = url;
      const res = await courier({ params: { code: VECTOR_CODE } } as any);
      expect(res.headers.get("location")).toBe(`/t/${VECTOR_CODE}`);
    }
    lastMile.url = "https://www.dtdc.in/x";
    const bad = VECTOR_CODE.slice(0, -1) + "a";
    expect((await courier({ params: { code: bad } } as any)).headers.get("location")).toBe(`/t/${bad}`);
  });
});
