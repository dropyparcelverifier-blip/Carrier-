import { describe, it, expect } from "vitest";
import {
  etaAt,
  stagePct,
  anchoredStageTime,
  anchoredSuggestedStage,
  compressSkippedStages,
  isOverdue,
  anchorFromRow,
  CALENDAR_FACTOR,
} from "../lib/stage-clock";
import { STAGES } from "../lib/types";

const DAY = 24 * 60 * 60 * 1000;
const ROUTE = null; // default route
const ORDER_DATE = "2026-08-01T00:00:00.000Z";
const DAYS = 12;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/* ═══ etaAt (task 3.1) ═══════════════════════════ */

describe("etaAt", () => {
  it("converts working days to calendar days at 1.2x", () => {
    const eta = etaAt(ORDER_DATE, 12);
    const expected = new Date(Date.parse(ORDER_DATE) + 12 * 1.2 * DAY);
    expect(eta.getTime()).toBe(expected.getTime());
  });

  it("12 working days lands 14.4 calendar days out", () => {
    const eta = etaAt(ORDER_DATE, 12);
    const elapsedDays = (eta.getTime() - Date.parse(ORDER_DATE)) / DAY;
    expect(elapsedDays).toBeCloseTo(14.4, 5);
  });

  it("scales linearly with shipping days", () => {
    const a = etaAt(ORDER_DATE, 10).getTime() - Date.parse(ORDER_DATE);
    const b = etaAt(ORDER_DATE, 20).getTime() - Date.parse(ORDER_DATE);
    expect(b).toBe(a * 2);
  });

  it("CALENDAR_FACTOR is the documented 1.2", () => {
    expect(CALENDAR_FACTOR).toBe(1.2);
  });
});

/* ═══ Case 1 — anchored re-scaling (task 3.3) ════ */

describe("anchoredStageTime — Case 1", () => {
  const anchorAt = "2026-08-06T00:00:00.000Z"; // day 5
  const anchor = { stage: "arrived_india" as const, at: anchorAt };

  it("returns null with no anchor, so callers fall through unchanged", () => {
    expect(anchoredStageTime(ROUTE, "mid_transit", ORDER_DATE, DAYS, null)).toBeNull();
  });

  it("leaves stages BEFORE the anchor on their original schedule", () => {
    // packed sits well before arrived_india — must not be rewritten
    const t = anchoredStageTime(ROUTE, "packed", ORDER_DATE, DAYS, anchor);
    expect(t).toBeNull();
  });

  it("leaves the anchor stage itself alone", () => {
    const t = anchoredStageTime(ROUTE, "arrived_india", ORDER_DATE, DAYS, anchor);
    expect(t).toBeNull();
  });

  it("re-scales stages AFTER the anchor", () => {
    const t = anchoredStageTime(ROUTE, "indian_customs", ORDER_DATE, DAYS, anchor);
    expect(t).not.toBeNull();
    expect(t!.getTime()).toBeGreaterThan(Date.parse(anchorAt));
  });

  it("NEVER moves the ETA — the last stage lands at or before it", () => {
    // This is the Gate 3 decision: option (b), ETA holds.
    const eta = etaAt(ORDER_DATE, DAYS).getTime();
    for (const s of STAGES) {
      const t = anchoredStageTime(ROUTE, s.key, ORDER_DATE, DAYS, anchor);
      if (t) expect(t.getTime()).toBeLessThanOrEqual(eta + 1);
    }
  });

  it("keeps re-scaled stages in chronological order", () => {
    const times: number[] = [];
    for (const s of STAGES) {
      const t = anchoredStageTime(ROUTE, s.key, ORDER_DATE, DAYS, anchor);
      if (t) times.push(t.getTime());
    }
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });

  it("is idempotent — same anchor, same result", () => {
    const a = anchoredStageTime(ROUTE, "indian_customs", ORDER_DATE, DAYS, anchor);
    const b = anchoredStageTime(ROUTE, "indian_customs", ORDER_DATE, DAYS, anchor);
    expect(a!.getTime()).toBe(b!.getTime());
  });

  it("collapses safely when the anchor is set past the ETA", () => {
    const late = { stage: "arrived_india" as const, at: "2026-09-30T00:00:00.000Z" };
    const t = anchoredStageTime(ROUTE, "indian_customs", ORDER_DATE, DAYS, late);
    // Must not produce a time before the anchor
    expect(t!.getTime()).toBeGreaterThanOrEqual(Date.parse(late.at));
  });
});

describe("anchoredSuggestedStage — Case 1", () => {
  const anchor = { stage: "arrived_india" as const, at: "2026-08-06T00:00:00.000Z" };

  it("returns null with no anchor", () => {
    expect(anchoredSuggestedStage(ROUTE, ORDER_DATE, DAYS, null)).toBeNull();
  });

  it("never regresses below the anchor stage", () => {
    // now = one minute after the anchor; nothing later has been reached
    const now = Date.parse(anchor.at) + 60_000;
    expect(anchoredSuggestedStage(ROUTE, ORDER_DATE, DAYS, anchor, now)).toBe("arrived_india");
  });

  it("advances past the anchor as time passes", () => {
    const later = etaAt(ORDER_DATE, DAYS).getTime() - 60_000;
    const stage = anchoredSuggestedStage(ROUTE, ORDER_DATE, DAYS, anchor, later);
    const anchorIdx = STAGES.findIndex((s) => s.key === "arrived_india");
    const reachedIdx = STAGES.findIndex((s) => s.key === stage);
    expect(reachedIdx).toBeGreaterThan(anchorIdx);
  });

  it("never suggests handed_to_courier — that is a real handover", () => {
    const wayLater = etaAt(ORDER_DATE, DAYS).getTime() + 100 * DAY;
    const stage = anchoredSuggestedStage(ROUTE, ORDER_DATE, DAYS, anchor, wayLater);
    expect(stage).not.toBe("handed_to_courier");
  });
});

/* ═══ Case 2 — backfill compression (task 3.6) ═══ */

describe("compressSkippedStages — Case 2", () => {
  const clockWasAt = new Date("2026-08-06T00:00:00.000Z"); // day 5
  const qcHappened = new Date("2026-08-08T00:00:00.000Z"); // day 7
  const skipped = [
    "arrived_india",
    "indian_customs",
    "customs_cleared",
    "at_vashi_warehouse",
  ] as const;

  it("returns empty for no skipped stages", () => {
    expect(compressSkippedStages([], clockWasAt, qcHappened).size).toBe(0);
  });

  it("places every skipped stage strictly between the two anchors", () => {
    const out = compressSkippedStages([...skipped], clockWasAt, qcHappened);
    for (const [, t] of out) {
      expect(t.getTime()).toBeGreaterThan(clockWasAt.getTime());
      expect(t.getTime()).toBeLessThan(qcHappened.getTime());
    }
  });

  it("keeps skipped stages in order", () => {
    const out = compressSkippedStages([...skipped], clockWasAt, qcHappened);
    const times = skipped.map((s) => out.get(s)!.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("NO stage timestamp is later than the real QC event", () => {
    // The bug this whole function exists to prevent: "Arrived in India —
    // 11 Aug" rendering after "Quality check approved — 8 Aug".
    const out = compressSkippedStages([...skipped], clockWasAt, qcHappened);
    for (const [, t] of out) {
      expect(t.getTime()).toBeLessThanOrEqual(qcHappened.getTime());
    }
  });

  it("spreads evenly", () => {
    const out = compressSkippedStages([...skipped], clockWasAt, qcHappened);
    const times = skipped.map((s) => out.get(s)!.getTime());
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], -3);
  });

  it("pins everything to the real event when QC precedes the clock", () => {
    const out = compressSkippedStages([...skipped], qcHappened, clockWasAt);
    for (const [, t] of out) {
      expect(t.getTime()).toBe(clockWasAt.getTime());
    }
  });
});

/* ═══ Overdue (task 3.7) ═════════════════════════ */

describe("isOverdue", () => {
  const beforeEta = etaAt(ORDER_DATE, DAYS).getTime() - DAY;
  const afterEta = etaAt(ORDER_DATE, DAYS).getTime() + DAY;

  it("is false inside the window", () => {
    expect(isOverdue(ORDER_DATE, DAYS, "mid_transit", beforeEta)).toBe(false);
  });

  it("is true past the window", () => {
    expect(isOverdue(ORDER_DATE, DAYS, "mid_transit", afterEta)).toBe(true);
  });

  it("is never true at qc_check — the parcel arrived", () => {
    expect(isOverdue(ORDER_DATE, DAYS, "qc_check", afterEta)).toBe(false);
  });

  it("is never true at handed_to_courier", () => {
    expect(isOverdue(ORDER_DATE, DAYS, "handed_to_courier", afterEta)).toBe(false);
  });

  it("is never true for a damaged order", () => {
    expect(isOverdue(ORDER_DATE, DAYS, "damaged", afterEta)).toBe(false);
  });

  it("is never true for an order already on hold", () => {
    expect(isOverdue(ORDER_DATE, DAYS, "exception", afterEta)).toBe(false);
  });

  it("adding days un-overdues an order — no cron needed", () => {
    // The reason overdue is computed, not stored: DOC calling add-days
    // must take effect immediately.
    expect(isOverdue(ORDER_DATE, 12, "mid_transit", afterEta)).toBe(true);
    expect(isOverdue(ORDER_DATE, 20, "mid_transit", afterEta)).toBe(false);
  });
});

/* ═══ anchorFromRow ══════════════════════════════ */

describe("anchorFromRow", () => {
  it("returns null when both columns are null", () => {
    expect(anchorFromRow(null, null)).toBeNull();
  });

  it("returns null on a HALF anchor — stage without time", () => {
    expect(anchorFromRow("arrived_india", null)).toBeNull();
  });

  it("returns null on a half anchor — time without stage", () => {
    expect(anchorFromRow(null, "2026-08-06T00:00:00Z")).toBeNull();
  });

  it("rejects a stage key that is not real", () => {
    expect(anchorFromRow("not_a_stage", "2026-08-06T00:00:00Z")).toBeNull();
  });

  it("builds a valid anchor from both columns", () => {
    const a = anchorFromRow("arrived_india", "2026-08-06T00:00:00Z");
    expect(a).toEqual({ stage: "arrived_india", at: "2026-08-06T00:00:00Z" });
  });
});


/* ═══ PINNED ARITHMETIC ══════════════════════════
   The ordering and bounds tests above all pass even when the re-scale
   formula is replaced with `fraction = p`, because a wrong formula that
   still yields increasing values inside the window satisfies every one of
   them. Found by mutation testing. These pin the actual numbers.
   ═══════════════════════════════════════════════ */

describe("Case 1 — exact re-scale arithmetic", () => {
  // order 2026-08-01, 12 working days => ETA 2026-08-15T09:36:00Z
  // anchor: arrived_india (pct 0.6736) at 2026-08-06T00:00:00Z
  // window = ETA - anchor = 812,160,000 ms (9.4 days)
  const anchor = { stage: "arrived_india" as const, at: "2026-08-06T00:00:00.000Z" };
  const ANCHOR_MS = Date.parse("2026-08-06T00:00:00.000Z");
  const ETA_MS = Date.parse("2026-08-15T09:36:00.000Z");
  const WINDOW = ETA_MS - ANCHOR_MS;

  it("ETA is exactly 2026-08-15T09:36:00Z", () => {
    expect(etaAt(ORDER_DATE, DAYS).toISOString()).toBe("2026-08-15T09:36:00.000Z");
  });

  it("indian_customs lands at the REMAINING-window proportion, not raw pct", () => {
    // pAnchor = 0.6736, p = 0.7569
    // fraction = (0.7569 - 0.6736) / (1 - 0.6736) = 0.0833 / 0.3264 = 0.25521...
    const pAnchor = stagePct(ROUTE, "arrived_india");
    const p = stagePct(ROUTE, "indian_customs");
    const expectedFraction = (p - pAnchor) / (1 - pAnchor);
    const expected = ANCHOR_MS + expectedFraction * WINDOW;

    const actual = anchoredStageTime(ROUTE, "indian_customs", ORDER_DATE, DAYS, anchor)!;
    expect(actual.getTime()).toBeCloseTo(expected, -2);

    // And it must NOT equal the naive raw-pct version, which is the
    // mutation this test exists to kill.
    const naive = ANCHOR_MS + p * WINDOW;
    expect(Math.abs(actual.getTime() - naive)).toBeGreaterThan(60_000);
  });

  it("the stage at pct 1.0 lands exactly on the ETA", () => {
    // qc_check has timing_pct 1.0 — fraction = 1, so it must land on ETA
    const t = anchoredStageTime(ROUTE, "qc_check", ORDER_DATE, DAYS, anchor)!;
    expect(t.getTime()).toBeCloseTo(ETA_MS, -2);
  });

  it("a stage immediately after the anchor lands NEAR the anchor, not mid-window", () => {
    // With the correct formula, the first stage after the anchor is only
    // a small fraction into the remaining window. With `fraction = p` it
    // would jump ~67% of the way in immediately.
    const t = anchoredStageTime(ROUTE, "indian_customs", ORDER_DATE, DAYS, anchor)!;
    const elapsedFraction = (t.getTime() - ANCHOR_MS) / WINDOW;
    expect(elapsedFraction).toBeLessThan(0.35);
  });
});

/* ═══ TASK 3.4 — consistency across call sites ═══ */

describe("task 3.4 — all timing paths agree for an anchored order", () => {
  const anchor = { stage: "arrived_india" as const, at: "2026-08-06T00:00:00.000Z" };

  it("the suggested stage's own time has already passed", () => {
    // If anchoredSuggestedStage says we've reached stage X, then
    // anchoredStageTime(X) must be <= now. If these two disagree, an
    // order's timeline contradicts its own progress bar and NOTHING
    // throws — which is exactly the silent failure this test exists for.
    const now = Date.parse("2026-08-12T00:00:00.000Z");
    const reached = anchoredSuggestedStage(ROUTE, ORDER_DATE, DAYS, anchor, now)!;
    const t = anchoredStageTime(ROUTE, reached, ORDER_DATE, DAYS, anchor);
    if (t) expect(t.getTime()).toBeLessThanOrEqual(now);
  });

  it("the NEXT stage after the suggested one has NOT passed", () => {
    const now = Date.parse("2026-08-12T00:00:00.000Z");
    const reached = anchoredSuggestedStage(ROUTE, ORDER_DATE, DAYS, anchor, now)!;
    const idx = STAGES.findIndex((s) => s.key === reached);
    const next = STAGES.slice(idx + 1).find((s) => s.key !== "handed_to_courier");
    if (next) {
      const t = anchoredStageTime(ROUTE, next.key, ORDER_DATE, DAYS, anchor);
      if (t) expect(t.getTime()).toBeGreaterThan(now);
    }
  });

  it("holds at every hour across the whole window", () => {
    // Sweeping the window catches ordering bugs that a single sampled
    // timestamp would walk straight past.
    const start = Date.parse(anchor.at);
    const end = etaAt(ORDER_DATE, DAYS).getTime();
    for (let now = start; now <= end; now += 60 * 60 * 1000) {
      const reached = anchoredSuggestedStage(ROUTE, ORDER_DATE, DAYS, anchor, now)!;
      const t = anchoredStageTime(ROUTE, reached, ORDER_DATE, DAYS, anchor);
      if (t) expect(t.getTime()).toBeLessThanOrEqual(now);
    }
  });

  it("stagePct is consistent between the two functions", () => {
    for (const s of STAGES) {
      const pct = stagePct(ROUTE, s.key);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(1);
    }
  });
});

/* ═══ INTEGRATION — the bug Case 2 exists to kill ═══
   Real scenario, using the default route's actual schedule:

     order placed  1 Aug, 12 shipping days
     clock reaches in_transit_departed on  7 Aug
     label generated                       8 Aug   <- early
     BUT the original schedule puts:
       arrived_india      10 Aug
       indian_customs     11 Aug
       customs_cleared    12 Aug
       at_vashi_warehouse 13 Aug

   Without compression those four render dated AFTER the 8 Aug QC event
   that overtook them. The timeline runs backwards and nothing throws.
   ═══════════════════════════════════════════════ */

describe("integration — early label never produces a backwards timeline", () => {
  const orderDate = "2026-08-01T00:00:00.000Z";
  const days = 12;
  const labelAt = new Date("2026-08-08T00:00:00.000Z");
  const clockWasAt = new Date(
    Date.parse(orderDate) + stagePct(ROUTE, "in_transit_departed") * days * 1.2 * DAY,
  );
  const skipped = [
    "mid_transit", "arrived_india", "indian_customs",
    "customs_cleared", "at_vashi_warehouse",
  ] as const;

  it("the premise is real — original schedule puts these AFTER the label", () => {
    // Guards the guard: if someone later "simplifies" compression away,
    // this proves the problem it solved was genuine.
    for (const s of skipped) {
      const original = Date.parse(orderDate) + stagePct(ROUTE, s) * days * 1.2 * DAY;
      expect(original).toBeGreaterThan(labelAt.getTime());
    }
  });

  it("the clock genuinely sat BEFORE the label event", () => {
    expect(clockWasAt.getTime()).toBeLessThan(labelAt.getTime());
  });

  it("compression puts every skipped stage before the label event", () => {
    const out = compressSkippedStages([...skipped], clockWasAt, labelAt);
    for (const s of skipped) {
      expect(out.get(s)!.getTime()).toBeLessThan(labelAt.getTime());
    }
  });

  it("the full rendered sequence is monotonically increasing", () => {
    const out = compressSkippedStages([...skipped], clockWasAt, labelAt);
    const sequence = [
      clockWasAt.getTime(),
      ...skipped.map((s) => out.get(s)!.getTime()),
      labelAt.getTime(),
    ];
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i]).toBeGreaterThan(sequence[i - 1]);
    }
  });

  it("every compressed stage falls strictly inside the real window", () => {
    const out = compressSkippedStages([...skipped], clockWasAt, labelAt);
    for (const s of skipped) {
      const t = out.get(s)!.getTime();
      expect(t).toBeGreaterThan(clockWasAt.getTime());
      expect(t).toBeLessThan(labelAt.getTime());
    }
  });
});
