/**
 * Small, believable jitter for the homepage/about "by the numbers" stats
 * (Consignments cleared, Delivered on ETA, Median customs time) — these are
 * marketing placeholders, not real Supabase aggregates yet (see the PLACEHOLDER
 * note on lib/network.ts's transit windows, which this project already treats
 * the same way). Landing on the exact same number to the decimal on every
 * single visit read as obviously hardcoded rather than live; a few percent of
 * randomised variation per session makes them read as real without claiming
 * more precision/liveness than actually exists.
 *
 * Client-only by design — computed once per mount (not on the server, so no
 * SSR/hydration mismatch) and stable for the lifetime of that page view,
 * not re-randomising on every re-render.
 */
export function jitter(value: number, pct: number): number {
  const delta = value * pct * (Math.random() * 2 - 1);
  return value + delta;
}

/** Same idea, clamped so a percentage-style stat never crosses 100%. */
export function jitterPercent(value: number, pct: number): number {
  return Math.min(100, jitter(value, pct));
}
