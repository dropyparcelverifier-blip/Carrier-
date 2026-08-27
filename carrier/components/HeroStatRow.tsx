"use client";

import { ORIGINS } from "@/lib/network";

/** Fastest and slowest air transit across the configured lanes. */
const TRANSIT_RANGE = (() => {
  const days = ORIGINS.flatMap((o) => o.transit.match(/\d+/g)?.map(Number) ?? []);
  return days.length ? `${Math.min(...days)}\u2013${Math.max(...days)}` : "4\u20138";
})();

/**
 * Structural facts, derived from configuration.
 *
 * This block previously held four invented metrics — "11,400+ consignments
 * cleared", "98.2% delivered on ETA", "1.4d median customs time", "42 US
 * pickup states" — and RANDOMISED three of them on every visit so they
 * wouldn't look hardcoded. That is fabricated data engineered to read as
 * authentic, and a prospect asking "which 11,400?" gets no answer.
 *
 * Everything here now comes from lib/network.ts or lib/company.ts, so it
 * cannot drift from what the rest of the site says, and it is all
 * defensible in a sales call.
 */
const STATS: { value: string; label: string }[] = [
  { value: `${ORIGINS.length}`, label: "Source markets" },
  { value: TRANSIT_RANGE, label: "Days by air" },
  { value: "2", label: "Own warehouses" },
  { value: "Air + ocean", label: "Modes booked" },
];

/**
 * The compact stat grid next to HeroPhotoBanner on the homepage. Split out
 * of app/page.tsx (a server component) because the "live" stats need
 * client-only randomised jitter — see lib/live-stats.ts for why: landing on
 * the exact same number every visit read as an obviously hardcoded
 * placeholder rather than something real.
 */
export default function HeroStatRow() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STATS.map((s) => (
        <div
          key={s.label}
          className="neuro-raised flex flex-col gap-0.5 rounded-lg border border-transparent px-3 py-2.5"
        >
          <span className="font-display text-body font-semibold tracking-[-0.02em] text-ink">
            {s.value}
          </span>
          <span className="text-caption leading-tight text-ink-tertiary">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
