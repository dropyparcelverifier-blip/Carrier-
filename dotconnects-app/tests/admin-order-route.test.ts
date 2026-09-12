import { describe, it, expect, vi, beforeEach } from "vitest";

/* The admin detail API returns the route map data built by the customer
   page's own mapRow, so both screens draw the same marker. A mapping
   failure must be reported on the response, never hide the order. */

const row = {
  id: 7, tracking_id: "TRAOJUFBBELMW", dropy_order_id: "Dropy-4251",
  customer_name: "Rahul Mehta", customer_mobile: "9876543210", customer_city: "Mumbai",
  items: [{ name: "CeraVe Moisturising Cream", qty: 1, weight_kg: 0.54, price_usd: 18 }],
  total_weight_kg: 0.54, total_items: 1, declared_value_usd: 18,
  shipping_days: 12, shipping_mode: "Air Freight", current_stage: "us_customs_cleared",
  route_key: null, timing_seed: 12345, status: "In Transit", progress: 40,
  estimated_delivery: "25 Sept 2026", carrier_name: "", awb_number: null, admin_notes: null,
  last_mile_courier: null, last_mile_awb: null, last_mile_tracking_url: null,
  order_date: "2026-09-08T11:05:00.000Z",
  clock_anchor_stage: null, clock_anchor_at: null,
  label_generated_at: null, picked_up_at: null, delivered_at: null,
};

function fakeSupabase(order: any) {
  const chain = (result: any) => {
    const q: any = {
      select: () => q, eq: () => q, order: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve({ data: order, error: null }),
    };
    return q;
  };
  return { from: (t: string) => chain(t === "dropy_order_events" ? { data: [], error: null } : { data: null, error: null }) };
}

const call = (GET: any) => GET({ cookies: {}, params: { id: "7" } } as any).then((r: Response) => r.json());

describe("GET /api/admin/orders/[id] — route map", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("$lib/server/guards", () => ({
      requireStaff: async () => ({ ok: true, supabase: fakeSupabase(row) }),
      requireAdmin: async () => ({ ok: true, supabase: fakeSupabase(row) }),
    }));
  });

  it("returns the customer page's route for the order", async () => {
    const { GET } = await import("../src/routes/api/admin/orders/[id]/+server");
    const { mapRow } = await import("$lib/server/shipment-service");
    const body = await call(GET);
    const customer = mapRow({ ...row, dropy_order_events: [] } as any);
    expect(body.order.tracking_id).toBe("TRAOJUFBBELMW");
    expect(body.routeError).toBe("");
    expect(body.route).toEqual({
      origin: customer.origin, destination: customer.destination,
      progress: customer.progress, mode: customer.mode,
    });
    expect(body.route.destination).toBe("Mumbai, India");
    expect(typeof body.route.origin).toBe("string");
    expect(body.route.origin.length).toBeGreaterThan(0);
  });

  it("reports a mapping failure instead of hiding the order", async () => {
    vi.doMock("$lib/server/shipment-service", () => ({ mapRow: () => { throw new Error("boom"); } }));
    const { GET } = await import("../src/routes/api/admin/orders/[id]/+server");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = await call(GET);
    err.mockRestore();
    expect(body.order.tracking_id).toBe("TRAOJUFBBELMW");
    expect(body.route).toBeNull();
    expect(body.routeError).toBe("boom");
  });
});
