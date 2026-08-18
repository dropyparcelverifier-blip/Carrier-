"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Plane, Ship, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CARRIERS, type Carrier } from "@/lib/network";
import { EASE, VIEWPORT } from "./motion/primitives";
import { cx } from "./ui";

/*
 * Carrier logos are shown for reference. They are the operators' registered
 * trademarks and this repo is public — see lib/network.ts#Carrier.logo. The
 * `mark` initials remain in the data as a licence-safe fallback.
 */

const LEGS: {
  leg: Carrier["leg"];
  icon: LucideIcon;
  chip: string;
  bar: string;
  blurb: string;
}[] = [
  {
    leg: "International air",
    icon: Plane,
    chip: "border-semantic-info/35 bg-semantic-info/12 text-semantic-info",
    bar: "bg-semantic-info",
    blurb: "Origin gateway to Mumbai. Which operator depends on the lane, the weight break and whether the cargo is dangerous goods.",
  },
  {
    leg: "Ocean",
    icon: Ship,
    chip: "border-primary/35 bg-primary/12 text-primary-hover",
    bar: "bg-primary",
    blurb: "FCL and weekly LCL consolidations for volume that does not need to fly.",
  },
  {
    leg: "India last mile",
    icon: Truck,
    chip: "border-semantic-success/35 bg-semantic-success/12 text-semantic-success",
    bar: "bg-semantic-success",
    blurb: "Vashi to your warehouse, against a signed proof of delivery.",
  },
];

export default function Carriers() {
  const reduce = useReducedMotion();

  return (
    <div className="grid items-start gap-5 lg:grid-cols-3">
      {LEGS.map((group, i) => {
        const Icon = group.icon;
        const list = CARRIERS.filter((c) => c.leg === group.leg);
        return (
          <motion.section
            key={group.leg}
            className="gradient-border edge-lift relative overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-md"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.65, delay: i * 0.08, ease: EASE }}
          >
            <span
              aria-hidden
              className={cx("absolute inset-x-0 top-0 z-[2] h-[3px]", group.bar)}
            />

            <div className="p-6 md:p-7">
              <span
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption",
                  group.chip,
                )}
              >
                <Icon className="size-3.5" strokeWidth={2} />
                {group.leg}
              </span>
              <p className="mt-4 text-body-sm text-ink-subtle">{group.blurb}</p>
            </div>

            <ul className="flex flex-col gap-px border-t border-hairline bg-hairline">
              {list.map((c) => (
                <li
                  key={c.name}
                  className="flex items-start gap-3.5 bg-surface-1 px-6 py-4 transition-colors hover:bg-surface-2 md:px-7"
                >
                  {/*
                    Real carrier logo on a white chip.

                    White regardless of theme: most of these marks are dark on
                    transparent, so on the dark canvas they would vanish. Chip
                    width follows the logo's aspect — a 13:1 wordmark squeezed
                    into a square renders a few pixels tall.

                    REFERENCE ONLY — these are the operators' trademarks. See
                    the note in lib/network.ts before this goes public.
                  */}
                  <span
                    className={cx(
                      "mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md bg-white p-1.5 ring-1",
                      c.logoAspect === "wide" && "h-9 w-20",
                      c.logoAspect === "square" && "h-9 w-9",
                      c.logoAspect === "tall" && "h-10 w-9",
                    )}
                    style={{ boxShadow: `inset 0 0 0 1px ${c.brand}33` }}
                  >
                    <Image
                      src={c.logo}
                      alt={`${c.name} logo`}
                      width={160}
                      height={80}
                      /* Next's optimizer rejects SVG unless dangerouslyAllowSVG
                         is set, which would admit any remote SVG including ones
                         carrying script. Serve these from /public instead. */
                      unoptimized={c.logo.endsWith(".svg")}
                      className="h-full w-full object-contain"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-body-sm font-medium text-ink">
                        {c.name}
                      </span>
                      <span className="font-mono text-[11px] text-ink-tertiary">
                        {c.service}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-caption text-ink-subtle">
                      {c.note}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </motion.section>
        );
      })}
    </div>
  );
}
