"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, ClipboardList, PackageCheck, Plane, Route, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EASE } from "./motion/primitives";
import { cx } from "./ui";

type Tone = "primary" | "blue" | "amber" | "green";

const STEPS: { icon: LucideIcon; label: string; detail: string; tone: Tone }[] = [
  { icon: ClipboardList, label: "Order placed", detail: "Confirmed, tracking ID issued", tone: "primary" },
  { icon: Plane, label: "In transit", detail: "Origin gateway to Mumbai", tone: "blue" },
  { icon: ShieldCheck, label: "Customs cleared", detail: "BOE filed, duty reconciled", tone: "amber" },
  { icon: PackageCheck, label: "Delivered", detail: "Handed off at Vashi", tone: "green" },
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

  // With 4 equal-width grid columns, each icon's centre sits at the
  // midpoint of its own column — 12.5%, 37.5%, 62.5%, 87.5% of the row —
  // not evenly spaced 0/33/66/100% the way naive `active / (n-1)` math
  // assumes. That mismatch was invisible at this card's original narrow
  // width but became visibly wrong once the card widened (the fill no
  // longer reached under the icon it was supposed to point at). Deriving
  // the fill's end position from the same column math the icons actually
  // use keeps them in sync at any container width.
  const colWidth = 100 / STEPS.length;
  const iconCenterPct = (i: number) => (i + 0.5) * colWidth;
  const trackStartPct = iconCenterPct(0);
  const trackEndPct = iconCenterPct(STEPS.length - 1);
  const progressPct =
    ((iconCenterPct(active) - trackStartPct) / (trackEndPct - trackStartPct)) * 100;

  return (
    // No card wrapper (border/shadow/gradient-border) — this used to be
    // one more in a run of 5+ back-to-back white bordered cards down the
    // page (Track, Quote, this, Reviews, FAQ all shared the identical
    // rounded-border-shadow recipe), which read as one repeated
    // component rather than distinct sections. This one and FAQ/Reviews
    // dropped the card; Track/Quote keep it since those two genuinely
    // read as tappable actions, not passive content, and should look
    // different from the read-only sections around them.
    <div className="relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-1.5 text-body font-medium text-ink">
            <Route className="size-4 text-primary" strokeWidth={1.8} />
            How it moves
          </h2>
          <p className="mt-1 text-caption text-ink-subtle">
            Every order follows the same four stages, end to end.
          </p>
        </div>
        <span className="text-caption font-medium text-ink-tertiary">
          {STEPS[active].label}
        </span>
      </div>

      <div className="relative mt-7 grid grid-cols-4 items-start">
        {/* Track + fill span exactly from the first icon's column centre
            to the last icon's column centre — computed from the same
            4-equal-column grid the icons themselves sit in (see
            iconCenterPct above), so the two stay in sync at any card
            width instead of assuming icons are evenly spaced 0/33/66/100%
            along a fixed-inset line. */}
        <div
            className="neuro-pressed-sm absolute top-6 -z-[1] h-1.5 overflow-hidden rounded-full"
            style={{ left: `${trackStartPct}%`, right: `${100 - trackEndPct}%` }}
        >
          <motion.div
            className={cx("h-full rounded-full shadow-sm", TONE_BAR[STEPS[active].tone])}
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
              className="group flex flex-col items-center gap-2.5 text-center"
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
              {/* Desktop only — this card stretches much wider once the
                  home page's hero column widens at lg:, and 4 icons with
                  nothing else read thin at that width. A one-line detail
                  per step gives it real content to fill the space with,
                  not just wider gaps between the same icons. Hidden below
                  lg so the original compact mobile/tablet card (which
                  this text would crowd) is untouched. */}
              <span className="hidden text-[10px] leading-tight text-ink-tertiary lg:block">
                {s.detail}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
