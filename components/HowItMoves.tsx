"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, ClipboardList, PackageCheck, Plane, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EASE } from "./motion/primitives";
import { cx } from "./ui";

type Tone = "primary" | "blue" | "amber" | "green";

const STEPS: { icon: LucideIcon; label: string; tone: Tone }[] = [
  { icon: ClipboardList, label: "Order placed", tone: "primary" },
  { icon: Plane, label: "In transit", tone: "blue" },
  { icon: ShieldCheck, label: "Customs cleared", tone: "amber" },
  { icon: PackageCheck, label: "Delivered", tone: "green" },
];

const TONE_ICON: Record<Tone, string> = {
  primary: "text-primary",
  blue: "text-vivid-blue",
  amber: "text-vivid-amber",
  green: "text-vivid-green",
};
const TONE_BAR: Record<Tone, string> = {
  primary: "bg-primary",
  blue: "bg-vivid-blue",
  amber: "bg-vivid-amber",
  green: "bg-vivid-green",
};
/* One composed box-shadow per tone (globals.css) — deliberately not
   `.neuro-raised` plus a Tailwind `shadow-*` utility, which would silently
   replace the neumorphic shadow instead of combining with it. */
const TONE_GLOW: Record<Tone, string> = {
  primary: "neuro-glow-primary",
  blue: "neuro-glow-blue",
  amber: "neuro-glow-amber",
  green: "neuro-glow-green",
};

const STEP_MS = 2200;

/**
 * Condensed journey strip for the home screen. Rather than a static row of
 * icons (or, before this, just a dot sliding back and forth on a line),
 * this actually steps through the four stages — one is always "current",
 * the ones before it read as done, the ones after as not-yet-reached, and
 * a fill bar tracks progress between them — so it reads as an order
 * actually moving through the pipeline rather than decoration. It's not
 * tied to a real shipment (this is the home screen, before any lookup),
 * so it loops continuously as an illustration of the shape of the journey.
 */
export default function HowItMoves() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    // Auto-advancing content is its own kind of motion — respect
    // prefers-reduced-motion by freezing on a single illustrative step
    // rather than cycling forever.
    if (reduce) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % STEPS.length);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [reduce]);

  const progressPct = (active / (STEPS.length - 1)) * 100;

  return (
    <div className="gradient-border edge-lift relative mt-4 overflow-hidden rounded-xl border border-hairline bg-surface-1 p-5 shadow-lg sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-body font-medium text-ink">How it moves</h2>
          <p className="mt-1 text-caption text-ink-subtle">
            Every order follows the same four stages, end to end.
          </p>
        </div>
        <span className="text-caption font-medium text-ink-tertiary">
          {STEPS[active].label}
        </span>
      </div>

      <div className="relative mt-7 flex items-start justify-between">
        {/* Track + fill sit exactly between the first and last icon centres
            (each step column is w-16 with a centred size-12 icon, so the
            centre sits 32px = left-8/right-8 in from each edge). */}
        <div className="absolute top-6 right-8 left-8 -z-[1] h-1 overflow-hidden rounded-full bg-hairline">
          <motion.div
            className={cx("h-full rounded-full", TONE_BAR[STEPS[active].tone])}
            animate={{ width: `${progressPct}%` }}
            transition={reduce ? { duration: 0 } : { duration: 0.6, ease: EASE }}
          />
        </div>

        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < active;
          const current = i === active;

          return (
            <Link
              key={s.label}
              href="/quote#how-it-works"
              className="group flex w-16 flex-col items-center gap-2.5 text-center"
            >
              <span
                // neuro-surface: badges sit on this card's own bg-surface-1.
                // Exactly one of these three applies — pending (neutral
                // raised), done (settled/pressed in, with a check overlay),
                // or current (raised + the tone's own glow, one composed
                // box-shadow, not two shadow classes stacked on each other).
                className={cx(
                  "neuro-surface relative flex size-12 items-center justify-center rounded-full transition-all duration-500 ease-out group-hover:-translate-y-0.5 group-active:scale-95",
                  current && cx(TONE_GLOW[s.tone], "scale-110"),
                  done && "neuro-pressed-sm",
                  !current && !done && "neuro-raised",
                )}
              >
                <Icon
                  className={cx(
                    "size-5 transition-colors duration-500",
                    current || done ? TONE_ICON[s.tone] : "text-ink-tertiary",
                  )}
                  strokeWidth={current ? 2.2 : 1.8}
                />
                {done ? (
                  <span
                    className={cx(
                      "absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-white",
                      TONE_BAR[s.tone],
                    )}
                  >
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                ) : null}
              </span>
              <span
                className={cx(
                  "text-[11px] leading-tight transition-colors duration-500",
                  current ? "font-medium text-ink" : "text-ink-tertiary",
                )}
              >
                {s.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
