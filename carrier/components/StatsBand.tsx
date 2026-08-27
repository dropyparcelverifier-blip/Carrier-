"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import {
  Clock4,
  Globe2,
  Handshake,
  MapPinned,
  PackageCheck,
  Plane,
  Users2,
  Warehouse,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IMAGES } from "@/lib/images";
import { LANES, ORIGINS } from "@/lib/network";
import { jitter, jitterPercent } from "@/lib/live-stats";
import { AnimatedNumber, EASE, VIEWPORT } from "./motion/primitives";

/**
 * Icon KEYS, not component references — this component is "use client", and
 * a server component (app/page.tsx builds HOME_STATS) can't pass a function/
 * component reference as a prop across that boundary (React: "Only plain
 * objects can be passed to Client Components"). Callers pass a string key;
 * the actual lucide component is resolved from this map inside the client
 * boundary instead.
 */
const ICONS = {
  packageCheck: PackageCheck,
  clock: Clock4,
  warehouse: Warehouse,
  globe: Globe2,
  users: Users2,
  handshake: Handshake,
  plane: Plane,
  mapPinned: MapPinned,
} satisfies Record<string, LucideIcon>;
export type StatsBandIconKey = keyof typeof ICONS;

/*
 * This band commits to being photographic.
 *
 * It previously ran the image at 22% under a canvas scrim, which read as a
 * muddy gradient rather than a picture — neither a photo nor a clean panel.
 * Now the photo carries it at full strength under a fixed dark scrim, and the
 * type is white in BOTH themes. That makes it a deliberate dark moment in the
 * light page instead of a washed-out rectangle, and it needs no theme-specific
 * colour work: white on a ~75% black scrim clears AA everywhere.
 */

/*
 * Colours below are literal hex, not the `vivid-*` tokens used everywhere
 * else — this band's scrim is a fixed dark colour "intentionally not
 * theme-aware" (see the note above), and the vivid tokens' light-mode
 * values are darkened for a light canvas. Resolved against this permanently
 * dark scrim they'd drop under 3:1, unreadable in light mode specifically.
 * These are the dark-mode vivid values, pinned so they hold regardless of
 * theme, exactly like the scrim itself.
 */
export type StatsBandStat = {
  value: number;
  decimals?: number;
  suffix?: string;
  label: string;
  icon: StatsBandIconKey;
  chip: string;
  iconColor: string;
  /** Jittered per session — a plausible live metric, not a fixed structural fact. */
  live?: "count" | "percent";
};

/**
 * Default content — the shipping-performance numbers, used on /about. Home
 * shows a DIFFERENT set (client/carrier/route facts — see HOME_STATS in
 * app/page.tsx) so the same photographic band on both pages doesn't just
 * repeat HeroStatRow's numbers a second time on the homepage.
 */
export /**
 * Used by /about, which renders <StatsBand /> with no props.
 *
 * These four were invented — "11,400 US consignments cleared", "98.2%
 * delivered on ETA", "1.4d median customs", "42 US pickup states" — and
 * three were randomised per visit so they wouldn't look hardcoded.
 *
 * Replaced with structure derived from lib/network.ts. When there are
 * real operational numbers they belong here, sourced from the database
 * rather than a constant, and they can drop the derivation.
 */
const DEFAULT_STATS: StatsBandStat[] = [
  {
    value: ORIGINS.length,
    label: "Source markets feeding our Mumbai gateway",
    icon: "globe",
    chip: "border-[#3f8ff0]/40 bg-[#3f8ff0]/20",
    iconColor: "#2563c9",
  },
  {
    value: LANES.filter((l) => l.mode === "air").length,
    label: "Direct air lanes into Mumbai",
    icon: "plane",
    chip: "border-[#34b871]/40 bg-[#34b871]/20",
    iconColor: "#1f9455",
  },
  {
    value: 2,
    label: "Own warehouses at origin and destination",
    icon: "warehouse",
    chip: "border-[#e0a04a]/40 bg-[#e0a04a]/20",
    iconColor: "#b8791f",
  },
  {
    value: 1,
    suffix: " carton",
    label: "Minimum consignment we'll book",
    icon: "packageCheck",
    chip: "border-[#a06cf5]/40 bg-[#a06cf5]/20",
    iconColor: "#7926df",
  },
];


export default function StatsBand({ stats = DEFAULT_STATS }: { stats?: StatsBandStat[] }) {
  const reduce = useReducedMotion();

  // Computed once per mount (client-only — no SSR/hydration mismatch) and
  // stable for this page view, so the count-up animates to one number and
  // stays there rather than jittering again on every re-render.
  const [values] = useState(() =>
    stats.map((s) => {
      if (s.live === "count") return jitter(s.value, 0.02);
      if (s.live === "percent") return jitterPercent(s.value, 0.01);
      return s.value;
    }),
  );

  // The dark base sits on the CONTAINER, not only in the scrim overlay. The
  // scrim is a sibling of the text, not an ancestor, so if the photo ever
  // fails to load the white type would otherwise land on the light canvas —
  // unreadable. An opaque base makes the contrast hold regardless.
  return (
    // @container: the grid below sizes its columns off THIS element's own
    // rendered width, not the browser viewport. StatsBand renders inside a
    // narrow max-w-3xl column on the homepage but full-width on /about —
    // a viewport breakpoint (xl:grid-cols-4) can't tell those apart, so it
    // was going 4-across inside a 768px box on the homepage, leaving each
    // card ~72px wide — nowhere near enough room for "9,04,615+".
    <div className="relative isolate overflow-hidden rounded-xxl border border-hairline bg-surface-1 shadow-lg @container">
      <Image
        src={IMAGES.containerShip.src}
        alt={IMAGES.containerShip.alt}
        fill
        sizes="100vw"
        className="object-cover opacity-[0.07]"
      />

      {/* Light wash, theme-aware. This was a fixed dark scrim with white
          type in both themes — a deliberate dark moment, which read as a
          black slab dropped between two cream sections rather than as
          emphasis. The photo now sits at 7% as texture. */}
      <div className="absolute inset-0 bg-gradient-to-r from-surface-1 via-surface-1/85 to-surface-1/70" />

      <div className="relative z-[1] p-7 md:p-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-eyebrow uppercase text-ink-tertiary">
          By the numbers
        </span>

        {/* Container-query breakpoints, not viewport ones — see the
            @container note above. Single column below @2xl (672px) —
            most phones' usable width after the card's own p-7 padding
            sits under that, so this stays one-per-row on mobile instead
            of going 2-across as soon as a phone is wide enough to
            technically fit two narrow numbers; @2xl:grid-cols-2 is where
            there's genuinely tablet-or-wider room for a real 2-up
            layout. Later thresholds tuned so a column only goes fully
            multi-across once there's ~200px+ per card: enough for the
            longest real value ("9,04,615+") on one line at the fixed
            sizes below. Full literal class strings in each branch, not a
            template-interpolated class name — Tailwind's scanner
            extracts classes via static string matching and can miss an
            interpolated one. */}
        <div
          className={
            stats.length >= 5
              ? "mt-9 grid gap-8 @2xl:grid-cols-2 @5xl:grid-cols-5"
              : "mt-9 grid gap-8 @2xl:grid-cols-2 @4xl:grid-cols-4"
          }
        >
          {stats.map((stat, i) => {
            const Icon = ICONS[stat.icon];
            return (
              <motion.div
                key={stat.label}
                className="transition-transform duration-300 ease-out hover:-translate-y-1"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
              >
                <span
                  className={`inline-flex size-10 items-center justify-center rounded-md border backdrop-blur-sm ${stat.chip}`}
                  style={{ color: stat.iconColor }}
                >
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                {/* Fixed steps keyed to @container width, not viewport —
                    a vw-driven size (or a sm:/lg: viewport variant) sizes
                    every card off the BROWSER width, not this specific
                    card's actual rendered width, which is exactly what
                    caused the original bug (4 narrow cards inside a
                    max-w-3xl column on the homepage, sized as if they had a
                    full-width viewport's room). @sm/@4xl here track the
                    same container the grid-cols breakpoints above use, so
                    font size and column count always agree on how much
                    room a card actually has. Sized so 9 characters
                    ("9,04,615+", en-IN grouping) clears one line at the
                    narrowest width each step guarantees.
                    whitespace-nowrap: never wrap ("26,84" / "0+" mid-value
                    read as broken text, not a responsive layout). */}
                <p className="mt-4 min-h-[1.15em] overflow-hidden font-display text-[22px] leading-[1.15] font-semibold tracking-[-0.02em] whitespace-nowrap text-ink @sm:text-[28px] @4xl:text-[34px]">
                  <AnimatedNumber
                    value={values[i]}
                    decimals={stat.decimals ?? 0}
                    suffix={stat.suffix ?? ""}
                  />
                </p>
                <p className="mt-3 max-w-[24ch] text-body-sm text-ink-subtle">
                  {stat.label}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
