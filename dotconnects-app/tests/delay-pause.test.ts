import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { journeyView } from "../src/lib/journey";
import { etaFor, delayDays, calendarDays, formatEta } from "../src/lib/dates";
import { STAGES } from "../src/lib/types";
import { suggestStageForOrderRoute } from "../src/lib/order-routes";

/* D1 — the delay pause.
 *
 * Delay was a flag with no arithmetic behind it: the stage froze on the
 * customer's page while the clock behind it kept running, so clearing the
 * hold let the parcel catch itself up in one jump and the delivery date
 * never moved at all. These tests are written so that removing the
 * subtraction in effectiveNow, or the addition in delayDays, turns one of
 * them red rather than passing quietly. */

const DAY = 86_400_000;
const T0 = Date.parse("2026-09-10T09:00:00.000Z");   // the moment of the pause
const ORDER_DATE = "2026-09-01T00:00:00.000Z";

const base = {
  route_key: "US15DTWO",
  order_date: ORDER_DATE,
  shipping_days: 13,
  timing_seed: 4251,
};

const idx = (k: string) => STAGES.findIndex((s) => s.key === k);
const stageAt = (at: number) =>
  suggestStageForOrderRoute(base.route_key, base.order_date, base.shipping_days, base.timing_seed, at);

describe("journeyView — the pause", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("pins a paused parcel at the instant it stopped, not at today", () => {
    vi.setSystemTime(new Date(T0 + 5 * DAY));

    const view = journeyView({
      ...base, current_stage: "exception",
      delayed_at: new Date(T0).toISOString(), delay_total_ms: 0,
    });

    expect(view.paused).toBe(true);
    expect(view.frozen).toBe(false);
    expect(view.capped).toBe(false);
    expect(view.reported).toBe("exception");
    expect(view.journey).toBe(stageAt(T0));
  });

  it("does not catch up after a resume — five days held costs five days", () => {
    vi.setSystemTime(new Date(T0 + 5 * DAY));

    const resumed = journeyView({
      ...base, current_stage: "mid_transit",
      delayed_at: null, delay_total_ms: 5 * DAY,
    });

    /* Where it left off, not where the schedule would have reached. */
    expect(resumed.journey).toBe(stageAt(T0));
    expect(resumed.paused).toBe(false);

    /* And the parcel that was NEVER held is further along at the same
       wall-clock moment. Without the subtraction these two are equal and
       the whole defect is back. */
    const never = journeyView({
      ...base, current_stage: "mid_transit", delayed_at: null, delay_total_ms: 0,
    });
    expect(idx(never.journey)).toBeGreaterThan(idx(resumed.journey));
  });

  it("keeps the history a held parcel used to lose", () => {
    vi.setSystemTime(new Date(T0 + 5 * DAY));

    /* held_at is deliberately absent: the delay path never wrote one, so
       the old frozen branch replayed from order_placed and every stage
       the box had genuinely passed vanished from the trail. */
    const view = journeyView({
      ...base, current_stage: "exception", held_at: null,
      delayed_at: new Date(T0).toISOString(), delay_total_ms: 0,
    });

    expect(view.journey).not.toBe("order_placed");
    expect(idx(view.journey)).toBeGreaterThan(idx("order_placed"));
  });

  it("leaves damaged frozen and cancelled capped, neither of them paused", () => {
    vi.setSystemTime(new Date(T0 + 5 * DAY));

    const damaged = journeyView({
      ...base, current_stage: "damaged", held_at: new Date(T0).toISOString(),
    });
    expect(damaged.frozen).toBe(true);
    expect(damaged.paused).toBe(false);

    const cancelled = journeyView({ ...base, current_stage: "cancelled" });
    expect(cancelled.capped).toBe(true);
    expect(cancelled.paused).toBe(false);
    expect(idx(cancelled.journey)).toBeLessThanOrEqual(idx("at_vashi_warehouse"));
  });

  it("a legacy row with no delayed_at still reads, and still reports the hold", () => {
    vi.setSystemTime(new Date(T0 + 5 * DAY));

    const view = journeyView({
      ...base, current_stage: "exception", delayed_at: null, delay_total_ms: null,
    });

    expect(view.paused).toBe(true);
    expect(view.reported).toBe("exception");
    expect(view.journey).toBe(stageAt(T0 + 5 * DAY));
  });

  it("an ordinary parcel is untouched by any of this", () => {
    vi.setSystemTime(new Date(T0));
    const view = journeyView({ ...base, current_stage: "dispatched" });
    expect(view.paused).toBe(false);
    expect(view.frozen).toBe(false);
    expect(view.capped).toBe(false);
  });
});

describe("delayDays and etaFor — both dates move with the hold", () => {
  const now = new Date(T0 + 5 * DAY);

  it("banks nothing when the parcel was never held", () => {
    expect(delayDays({ delayed_at: null, delay_total_ms: 0 }, now)).toBe(0);
  });

  it("counts a finished hold, rounded up", () => {
    expect(delayDays({ delayed_at: null, delay_total_ms: 5 * DAY }, now)).toBe(5);
    /* 26 hours has cost the customer a second day. Never rounds a promise
       earlier than it can be kept. */
    expect(delayDays({ delayed_at: null, delay_total_ms: 26 * 3_600_000 }, now)).toBe(2);
  });

  it("counts a hold that is still running", () => {
    expect(delayDays({ delayed_at: new Date(T0).toISOString(), delay_total_ms: 0 }, now)).toBe(5);
    /* Banked plus running, not one or the other. */
    expect(delayDays(
      { delayed_at: new Date(T0).toISOString(), delay_total_ms: 2 * DAY }, now,
    )).toBe(7);
  });

  it("moves the Dropy date and the doorstep date by the same days", () => {
    const clean = etaFor({ ...base, doorstep_days: 3 }, now);
    const held = etaFor(
      { ...base, doorstep_days: 3, delayed_at: null, delay_total_ms: 5 * DAY }, now,
    );

    const shift = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
    expect(shift(clean.dropy, held.dropy)).toBe(5);
    expect(shift(clean.doorstep!, held.doorstep!)).toBe(5);
  });

  it("still agrees with the window arithmetic that writes estimated_delivery", () => {
    const expected = new Date(ORDER_DATE);
    expected.setDate(expected.getDate() + calendarDays(13) + 5);
    const { dropy } = etaFor(
      { ...base, delayed_at: null, delay_total_ms: 5 * DAY }, now,
    );
    expect(formatEta(dropy)).toBe(formatEta(expected));
  });

  it("leaves a parcel with no pause exactly where it was", () => {
    const before = etaFor({ ...base, doorstep_days: 3 }, now);
    const after = etaFor(
      { ...base, doorstep_days: 3, delayed_at: null, delay_total_ms: 0 }, now,
    );
    expect(after.dropy.getTime()).toBe(before.dropy.getTime());
    expect(after.doorstep!.getTime()).toBe(before.doorstep!.getTime());
  });
});

/* ── the two writers ───────────────────────────────────────────────── */

type Sink = { orderPatch?: any; eventInserts: any[]; eventPatches: any[] };

function fakeSupabase(row: any, sink: Sink, events: any[] = []) {
  return {
    from(table: string) {
      if (table === "dropy_orders") {
        const q: any = {
          select: () => q,
          eq: () => q,
          maybeSingle: () => Promise.resolve({ data: row, error: null }),
          update: (patch: any) => {
            sink.orderPatch = { ...(sink.orderPatch ?? {}), ...patch };
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
        return q;
      }
      const e: any = {
        select: () => e,
        eq: () => Promise.resolve({ data: events, error: null }),
        insert: (v: any) => { sink.eventInserts.push(v); return Promise.resolve({ error: null }); },
        update: (patch: any) => {
          sink.eventPatches.push(patch);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
      return e;
    },
  } as any;
}

describe("pauseOrder", () => {
  let sink: Sink;
  beforeEach(() => {
    sink = { eventInserts: [], eventPatches: [] };
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
  });
  afterEach(() => vi.useRealTimers());

  it("stamps delayed_at with the stage, and writes no status", async () => {
    const { pauseOrder } = await import("../src/lib/order-status");
    const row = { ...base, current_stage: "mid_transit", items: [], delayed_at: null };

    const r = await pauseOrder(fakeSupabase(row, sink), 7, { reason: "Customs query" });

    expect(r).toMatchObject({ ok: true, prior_stage: "mid_transit" });
    expect(sink.orderPatch.current_stage).toBe("exception");
    expect(sink.orderPatch.delayed_at).toBe(new Date(T0).toISOString());
    /* The old endpoints wrote 'Customs Clearance' whatever stage the
       parcel was at. The stage already says where the box is. */
    expect(sink.orderPatch).not.toHaveProperty("status");
  });

  it("never puts the teammate's reason on the customer's trail", async () => {
    const { pauseOrder } = await import("../src/lib/order-status");
    const row = { ...base, current_stage: "mid_transit", items: [], delayed_at: null };

    await pauseOrder(fakeSupabase(row, sink), 7, { reason: "Customs hold — documentation" });

    expect(sink.eventInserts).toHaveLength(1);
    const ev = sink.eventInserts[0];
    expect(ev.stage).toBe("exception");
    expect(ev.note).toBe("Our team is working on it.");
    expect(JSON.stringify(ev)).not.toContain("documentation");
  });

  it("takes free text, because the customer never reads it", async () => {
    /* DOC has always sent a typed sentence here. Validating against
       DELAY_REASONS would reject it for no gain: the trail entry is a
       fixed line either way, and the text only reaches the audit log. */
    const { pauseOrder } = await import("../src/lib/order-status");
    const row = { ...base, current_stage: "mid_transit", items: [], delayed_at: null };
    const r = await pauseOrder(fakeSupabase(row, sink), 7, { reason: "stuck at Delhi customs" });
    expect(r).toMatchObject({ ok: true });
    expect(sink.eventInserts[0].note).toBe("Our team is working on it.");
  });

  it("refuses a parcel that is already paused, damaged or cancelled", async () => {
    const { pauseOrder } = await import("../src/lib/order-status");
    for (const stage of ["exception", "damaged", "cancelled", "qc_check"]) {
      const s: Sink = { eventInserts: [], eventPatches: [] };
      const row = { ...base, current_stage: stage, items: [], delayed_at: null };
      const r = await pauseOrder(fakeSupabase(row, s), 7, { reason: "Weather delay" });
      expect(r, stage).toHaveProperty("error");
      expect(s.orderPatch, stage).toBeUndefined();
    }
  });
});

describe("resumeOrder", () => {
  let sink: Sink;
  beforeEach(() => {
    sink = { eventInserts: [], eventPatches: [] };
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0 + 5 * DAY));
  });
  afterEach(() => vi.useRealTimers());

  it("banks the hold, clears the pause and rewrites the stored date", async () => {
    const { resumeOrder } = await import("../src/lib/order-status");
    const row = {
      ...base, current_stage: "exception", doorstep_days: 3,
      delayed_at: new Date(T0).toISOString(), delay_total_ms: 0,
    };

    const r: any = await resumeOrder(fakeSupabase(row, sink), 7);

    expect(r.ok).toBe(true);
    expect(r.paused_ms).toBe(5 * DAY);
    expect(sink.orderPatch.delayed_at).toBeNull();
    expect(sink.orderPatch.delay_total_ms).toBe(5 * DAY);

    /* estimated_delivery is a STORED STRING the customer page reads
       directly. Leaving it behind puts it in disagreement with etaFor the
       moment the hold ends. */
    const expected = new Date(ORDER_DATE);
    expected.setDate(expected.getDate() + calendarDays(13) + 5);
    expect(sink.orderPatch.estimated_delivery).toBe(formatEta(expected));
  });

  it("resumes where the parcel stopped, not where the schedule got to", async () => {
    const { resumeOrder } = await import("../src/lib/order-status");
    const row = {
      ...base, current_stage: "exception",
      delayed_at: new Date(T0).toISOString(), delay_total_ms: 0,
    };

    const r: any = await resumeOrder(fakeSupabase(row, sink), 7);

    expect(r.current_stage).toBe(stageAt(T0));
    expect(idx(r.current_stage)).toBeLessThan(idx(stageAt(T0 + 5 * DAY)));
  });

  it("adds to an existing total rather than replacing it", async () => {
    const { resumeOrder } = await import("../src/lib/order-status");
    const row = {
      ...base, current_stage: "exception",
      delayed_at: new Date(T0).toISOString(), delay_total_ms: 2 * DAY,
    };
    const r: any = await resumeOrder(fakeSupabase(row, sink), 7);
    expect(r.delay_total_ms).toBe(7 * DAY);
  });

  it("refuses a parcel that is not paused", async () => {
    const { resumeOrder } = await import("../src/lib/order-status");
    const row = { ...base, current_stage: "mid_transit", delayed_at: null, delay_total_ms: 0 };
    const r = await resumeOrder(fakeSupabase(row, sink), 7);
    expect(r).toHaveProperty("error");
    expect(sink.orderPatch).toBeUndefined();
  });

  it("banks nothing for a legacy row that has no pause timestamp", async () => {
    const { resumeOrder } = await import("../src/lib/order-status");
    const row = {
      ...base, current_stage: "exception", delayed_at: null, delay_total_ms: 0,
    };
    const r: any = await resumeOrder(fakeSupabase(row, sink), 7);
    expect(r.paused_ms).toBe(0);
    expect(r.delay_total_ms).toBe(0);
  });

  it("stands the hold down on the trail without deleting it", async () => {
    const { resumeOrder } = await import("../src/lib/order-status");
    const row = {
      ...base, current_stage: "exception",
      delayed_at: new Date(T0).toISOString(), delay_total_ms: 0,
    };
    const events = [{ id: 11, stage: "exception", state: "exception" }];
    await resumeOrder(fakeSupabase(row, sink, events), 7);
    expect(sink.eventPatches).toContainEqual({ state: "done" });
  });
});

/* ── the trail the customer actually reads ─────────────────────────
 *
 * The first pass tested journeyView and stopped there: the function
 * returned the right stage, every assertion passed, and the rendered
 * timeline still collapsed to a booking and a hold. shipment-service
 * carried its own exclusion for "exception" that predated D1, so the
 * synthetic backfill never ran for a paused parcel. Testing the unit is
 * not testing the page. */

describe("the paused trail", () => {
  const ORDER_ROW = {
    id: 9, tracking_id: "USLMU2WPCFI9658666", dropy_order_id: "Dropy-3929",
    customer_name: "Test", customer_mobile: "9000000000", customer_city: "Delhi",
    items: [], total_weight_kg: 1, total_items: 3, declared_value_usd: 60,
    shipping_days: 15, shipping_mode: "air", route_key: "US15DTWO",
    timing_seed: 4251, status: "In Transit", progress: 0,
    estimated_delivery: "03 Oct 2026", doorstep_days: 5,
    order_date: "2026-09-06T00:00:00.000Z",
    carrier_name: null, awb_number: null,
    last_mile_courier: null, last_mile_awb: null, last_mile_tracking_url: null,
    clock_anchor_stage: null, clock_anchor_at: null,
    label_generated_at: null, picked_up_at: null, delivered_at: null,
    held_at: null,
    dropy_order_events: [
      { stage: "order_placed", label: "Booking confirmed", location: "New York, NY",
        carrier: null, happened_at: "2026-09-06T06:46:00.000Z", note: "Order confirmed.",
        state: "done", sort_order: 0 },
      { stage: "exception", label: "Shipment on hold", location: "International airspace",
        carrier: null, happened_at: "2026-09-15T16:54:00.000Z",
        note: "Our team is working on it.", state: "exception", sort_order: 6 },
    ],
  };

  it("keeps every stage the box genuinely passed, not just the booking", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T17:00:00.000Z"));
    const { mapRow } = await import("../src/lib/server/shipment-service");

    const shipment = mapRow({
      ...ORDER_ROW, current_stage: "exception",
      delayed_at: "2026-09-15T16:54:00.000Z", delay_total_ms: 0,
    } as any);

    const shown = shipment.events.filter((e) => e.state !== "pending");
    /* A booking and a hold and nothing else is the bug. */
    expect(shown.length).toBeGreaterThan(2);
    expect(shown.some((e) => e.stage === "order_placed")).toBe(true);
    /* `exception` is not on the StageKey union — it is a hold, not a
       point on the route — so the comparison is widened rather than the
       type loosened. */
    expect(shown.some((e) => (e.stage as string) === "exception")).toBe(true);
    expect(shown.some((e) => e.stage === "dispatched")).toBe(true);
    vi.useRealTimers();
  });

  it("leaves the hold as the only live entry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T17:00:00.000Z"));
    const { mapRow } = await import("../src/lib/server/shipment-service");

    const shipment = mapRow({
      ...ORDER_ROW, current_stage: "exception",
      delayed_at: "2026-09-15T16:54:00.000Z", delay_total_ms: 0,
    } as any);

    expect(shipment.events.filter((e) => e.state === "current")).toHaveLength(0);
    expect(shipment.delayed).toBe(true);
    expect(shipment.eta).toBe("");
    expect(shipment.doorstepEta).toBe("");
    vi.useRealTimers();
  });

  it("previews no future stages while the clock is stopped", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T17:00:00.000Z"));
    const { mapRow } = await import("../src/lib/server/shipment-service");

    const shipment = mapRow({
      ...ORDER_ROW, current_stage: "exception",
      delayed_at: "2026-09-15T16:54:00.000Z", delay_total_ms: 0,
    } as any);

    expect(shipment.events.filter((e) => e.state === "pending")).toHaveLength(0);
    vi.useRealTimers();
  });

  it("still previews them for a parcel that is moving", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T17:00:00.000Z"));
    const { mapRow } = await import("../src/lib/server/shipment-service");

    const shipment = mapRow({
      ...ORDER_ROW, current_stage: "mid_transit",
      dropy_order_events: [ORDER_ROW.dropy_order_events[0]],
      delayed_at: null, delay_total_ms: 0,
    } as any);

    expect(shipment.events.filter((e) => e.state === "pending").length).toBeGreaterThan(0);
    expect(shipment.delayed).toBe(false);
    vi.useRealTimers();
  });
});
