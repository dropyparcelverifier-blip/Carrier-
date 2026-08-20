"use client";

import { useState } from "react";
import { jitter, jitterPercent } from "@/lib/live-stats";
import { ORIGINS } from "@/lib/network";
import { AnimatedNumber } from "./motion/primitives";

const STATS: {
  value: number;
  decimals?: number;
  suffix?: string;
  label: string;
  /** Jittered per session — a plausible live metric, not a fixed structural fact. */
  live?: "count" | "percent";
}[] = [
  { value: 11400, suffix: "+", label: "Consignments cleared", live: "count" },
  { value: 98.2, decimals: 1, suffix: "%", label: "Delivered on ETA", live: "percent" },
  { value: 1.4, decimals: 1, suffix: "d", label: "Median customs time", live: "count" },
  { value: 42, label: "US pickup states" },
  // "+" — ORIGINS lists the main/featured markets, not an exhaustive list;
  // Origins.tsx and the quote form's origin picker both already say other
  // countries ship on request (see lib/network.ts ORIGINS), so a bare "5"
  // here would read as a hard cap that contradicts that framing.
  { value: ORIGINS.length, suffix: "+", label: "Source markets" },
];

/**
 * The compact stat grid next to HeroPhotoBanner on the homepage. Split out
 * of app/page.tsx (a server component) because the "live" stats need
 * client-only randomised jitter — see lib/live-stats.ts for why: landing on
 * the exact same number every visit read as an obviously hardcoded
 * placeholder rather than something real.
 */
export default function HeroStatRow() {
  const [values] = useState(() =>
    STATS.map((s) => {
      if (s.live === "count") return jitter(s.value, 0.02);
      if (s.live === "percent") return jitterPercent(s.value, 0.01);
      return s.value;
    }),
  );

  return (
    // Flex-wrap, not grid — at 5 stats this naturally lays out as 3-over-2
    // with the second row's pair CENTRED (flex-wrap centres a short last
    // row on its own; a 3-col grid would leave it left-aligned with two
    // empty cells trailing it). Each card is a fixed fraction of the row
    // width, so it still holds a clean 3-per-row rhythm at any stat count.
    <dl className="mt-6 flex flex-wrap justify-center gap-3">
      {STATS.map((s, i) => (
        <div
          key={s.label}
          // Plain neuro-raised (not neuro-surface): these chips sit
          // directly on the page canvas, not inside a surface-1
          // card, so the shadow's light/dark mix should key off
          // canvas — the same surface it's visually popping out of.
          // No hover/press classes: these are read-only stats, not
          // a link or button, so nothing here should look tappable.
          // basis-[calc(33.333%-0.5rem)]: 3 per row accounting for the two
          // gap-3 (0.75rem) gutters split across 3 cards.
          className="neuro-raised flex min-w-[92px] shrink-0 grow basis-[calc(33.333%-0.5rem)] flex-col items-center justify-center rounded-lg border border-transparent px-2.5 py-3.5 text-center"
        >
          <dt className="sr-only">{s.label}</dt>
          <dd className="font-display text-[clamp(16px,3.4vw,20px)] font-semibold tracking-[-0.02em] text-ink">
            <AnimatedNumber value={values[i]} decimals={s.decimals ?? 0} suffix={s.suffix ?? ""} />
          </dd>
          <p className="mt-1 text-[10.5px] leading-tight text-ink-tertiary">{s.label}</p>
        </div>
      ))}
    </dl>
  );
}
