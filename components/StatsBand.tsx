"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Clock4, Globe2, PackageCheck, Users2, Warehouse } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IMAGES } from "@/lib/images";
import { ORIGINS } from "@/lib/network";
import { AnimatedNumber, EASE, VIEWPORT } from "./motion/primitives";

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
const STATS: {
  value: number;
  decimals?: number;
  suffix?: string;
  label: string;
  icon: LucideIcon;
  chip: string;
  iconColor: string;
}[] = [
  {
    value: 11400,
    suffix: "+",
    label: "US consignments cleared",
    icon: PackageCheck,
    chip: "border-[#3f8ff0]/40 bg-[#3f8ff0]/20",
    iconColor: "#7ab2f5",
  },
  {
    value: 98.2,
    decimals: 1,
    suffix: "%",
    label: "Delivered on or before the quoted ETA",
    icon: Clock4,
    chip: "border-[#34b871]/40 bg-[#34b871]/20",
    iconColor: "#6cd69a",
  },
  {
    value: 1.4,
    decimals: 1,
    suffix: " days",
    label: "Median customs clearance at air cargo",
    icon: Warehouse,
    chip: "border-[#f0a83d]/40 bg-[#f0a83d]/20",
    iconColor: "#f5c274",
  },
  {
    value: 42,
    label: "US pickup states covered",
    icon: Globe2,
    chip: "border-[#8b6ef2]/40 bg-[#8b6ef2]/20",
    iconColor: "#b0a0f7",
  },
  {
    value: ORIGINS.length,
    label: "Source markets feeding one Mumbai hub",
    icon: Users2,
    chip: "border-[#e8619f]/40 bg-[#e8619f]/20",
    iconColor: "#f0a0c4",
  },
];

export default function StatsBand() {
  const reduce = useReducedMotion();

  // The dark base sits on the CONTAINER, not only in the scrim overlay. The
  // scrim is a sibling of the text, not an ancestor, so if the photo ever
  // fails to load the white type would otherwise land on the light canvas —
  // unreadable. An opaque base makes the contrast hold regardless.
  return (
    <div className="relative isolate overflow-hidden rounded-xxl bg-[#0b0d12] shadow-xl">
      <Image
        src={IMAGES.containerShip.src}
        alt={IMAGES.containerShip.alt}
        fill
        sizes="100vw"
        className="object-cover opacity-90"
      />

      {/* fixed dark scrim — intentionally not theme-aware */}
      <div className="absolute inset-0 bg-[#0b0d12]/70" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0d12]/85 via-[#0b0d12]/50 to-[#0b0d12]/70" />

      <div className="relative z-[1] p-7 md:p-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-eyebrow uppercase text-white/85 backdrop-blur-sm">
          By the numbers
        </span>

        <div className="mt-9 grid gap-8 sm:grid-cols-2 xl:grid-cols-5">
          {STATS.map((stat, i) => {
            const Icon = stat.icon;
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
                <p className="mt-4 font-display text-[clamp(30px,3.6vw,44px)] leading-none font-semibold tracking-[-0.035em] text-white">
                  <AnimatedNumber
                    value={stat.value}
                    decimals={stat.decimals ?? 0}
                    suffix={stat.suffix ?? ""}
                  />
                </p>
                <p className="mt-3 max-w-[24ch] text-body-sm text-white/75">
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
