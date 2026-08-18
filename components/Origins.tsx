"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Plane } from "lucide-react";
import { ORIGINS } from "@/lib/network";
import { EASE, VIEWPORT } from "./motion/primitives";
import { cx } from "./ui";

const MotionLink = motion.create(Link);

/*
 * A distinct hue per market, drawn from the palette already contrast-verified
 * for text-on-tint. Used on the top bar and the gateway chip so the five cards
 * are tellable apart at a glance rather than five identical white boxes.
 */
const ACCENT = [
  { bar: "bg-primary", chip: "border-primary/35 bg-primary/12 text-primary-hover" },
  { bar: "bg-semantic-info", chip: "border-semantic-info/35 bg-semantic-info/12 text-semantic-info" },
  { bar: "bg-cat-cosmetics", chip: "border-cat-cosmetics/35 bg-cat-cosmetics/12 text-cat-cosmetics" },
  { bar: "bg-semantic-warn", chip: "border-semantic-warn/35 bg-semantic-warn/12 text-semantic-warn" },
  { bar: "bg-semantic-success", chip: "border-semantic-success/35 bg-semantic-success/12 text-semantic-success" },
];

export default function Origins() {
  const reduce = useReducedMotion();

  return (
    /*
     * Six columns, each card spanning two, so the five markets sit three-up.
     * A plain grid-cols-3 leaves the last row hanging left with a hole beside
     * it; nudging the fourth card to column 2 centres the pair underneath.
     */
    <div className="grid gap-5 md:grid-cols-6">
      {ORIGINS.map((o, i) => {
        const tone = ACCENT[i % ACCENT.length];
        return (
        <MotionLink
          key={o.country}
          href={`/quote?origin=${encodeURIComponent(o.gateway)}`}
          className={cx(
            "gradient-border edge-lift spotlight group relative flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface-1 p-6 pt-7 shadow-md transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-xl md:col-span-2 md:p-7 md:pt-8",
            i === 3 && "md:col-start-2",
          )}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.65, delay: i * 0.08, ease: EASE }}
        >
          <span
            aria-hidden
            className={cx("absolute inset-x-0 top-0 z-[2] h-[3px]", tone.bar)}
          />

          <div className="relative z-[1] flex items-center justify-between gap-3">
            {/* Flag and code in one pill. alt is empty on purpose — the code
                sits right beside it, so announcing the country twice would
                only add noise. */}
            <span
              className={cx(
                "inline-flex items-center gap-2 rounded-full border py-1 pr-2.5 pl-1 font-mono text-[11px]",
                tone.chip,
              )}
            >
              <Image
                src={o.flagSrc}
                alt=""
                width={30}
                height={20}
                unoptimized
                className="h-3.5 w-[22px] rounded-[2px] object-cover ring-1 ring-black/15"
              />
              {o.flag}
            </span>
            <span className="font-mono text-[11px] text-ink-tertiary">
              {o.transit}
            </span>
          </div>

          <h3 className="relative z-[1] mt-5 font-display text-card-title text-ink">
            {o.country}
          </h3>
          <p className="relative z-[1] mt-2 flex-1 text-body-sm text-ink-subtle">
            {o.focus}
          </p>

          <div className="relative z-[1] mt-6 border-t border-hairline pt-4">
            <p className="text-caption text-ink-tertiary">Consolidated at</p>
            <p className="mt-1 text-body-sm text-ink-muted">{o.hubs}</p>

            <p className="mt-4 flex items-center gap-2 font-mono text-[12px] text-ink-subtle">
              <Plane className="size-3.5 text-semantic-info" strokeWidth={1.9} />
              {o.gateway}
              <ArrowRight className="size-3 text-ink-tertiary" strokeWidth={2} />
              BOM
            </p>
          </div>

          {/* click affordance — same reveal-on-hover pattern as the client
              cards, so it reads as "get an estimate" rather than a plain
              info card */}
          <span
            aria-hidden
            className="absolute right-4 bottom-4 z-[1] flex size-8 translate-y-1 items-center justify-center rounded-full border border-hairline bg-surface-2 text-ink-tertiary opacity-0 transition-all duration-400 group-hover:translate-y-0 group-hover:opacity-100"
          >
            <ArrowRight className="size-4" strokeWidth={1.9} />
          </span>
        </MotionLink>
        );
      })}
    </div>
  );
}
