"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plane, Ship, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CARRIERS, type Carrier } from "@/lib/network";
import { EASE } from "./motion/primitives";
import { cx } from "./ui";

const STEP_MS = 4000;

const LEG_ICON: Record<Carrier["leg"], LucideIcon> = {
  "International air": Plane,
  Ocean: Ship,
  "India last mile": Truck,
};

const LEG_CHIP: Record<Carrier["leg"], string> = {
  "International air": "border-semantic-info/35 bg-semantic-info/12 text-semantic-info",
  Ocean: "border-primary/35 bg-primary/12 text-primary-hover",
  "India last mile": "border-semantic-success/35 bg-semantic-success/12 text-semantic-success",
};

/**
 * "Who carries it" on Home — a spotlight carousel, the same neumorphic
 * pressed-tray/raised-picker/colour-wash pattern as Clients.tsx's
 * ClientStrip, not the flat unlabelled logo wall this replaced. That wall
 * lost everything the full /quote#carriers grid conveys (which leg a
 * carrier handles, its service tier, why it's booked) down to a bare logo;
 * this keeps that context in a compact, one-at-a-time form instead.
 */
export default function CarrierStrip() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % CARRIERS.length);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [reduce, paused]);

  const c = CARRIERS[index];
  const LegIcon = LEG_ICON[c.leg];

  return (
    <div
      className="mx-auto max-w-2xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="neuro-pressed relative overflow-hidden rounded-2xl border border-hairline-tertiary p-5 sm:p-8"
        style={{ "--neuro-base": "var(--color-canvas)" } as React.CSSProperties}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-colors duration-700"
          style={{
            background: `radial-gradient(65% 55% at 50% 0%, ${c.brand}16, transparent 72%)`,
          }}
        />

        {/* Logo picker — bg-white stays on every chip regardless of active
            state (most of these logos are dark-on-transparent and need a
            light backing in dark mode), layered UNDER the neuro-raised/
            neuro-pressed-sm box-shadow rather than replacing it: Tailwind's
            bg-white utility only overrides the `background` half of what
            those classes set, never their box-shadow, so the two compose
            safely instead of one silently winning outright. */}
        <div className="relative flex flex-wrap items-center justify-center gap-2.5">
          {CARRIERS.map((carrier, i) => (
            <button
              key={carrier.name}
              type="button"
              aria-label={`Show ${carrier.name}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cx(
                "[--neuro-base:var(--color-canvas)] flex size-12 shrink-0 items-center justify-center rounded-lg border-2 border-transparent bg-white p-1.5 transition-all duration-300",
                i === index
                  ? "neuro-pressed-sm"
                  : "neuro-raised opacity-55 grayscale-[0.4] hover:-translate-y-0.5 hover:opacity-90 hover:grayscale-0",
              )}
              style={i === index ? { borderColor: `${carrier.brand}70` } : undefined}
            >
              <Image
                src={carrier.logo}
                alt=""
                aria-hidden
                width={80}
                height={40}
                unoptimized={carrier.logo.endsWith(".svg")}
                className="h-full w-full object-contain"
              />
            </button>
          ))}
        </div>

        {/* Spotlight — raised up out of the pressed tray, same as
            ClientStrip's card, just with a leg badge and service/note
            copy instead of city/focus. */}
        <div className="relative mt-6 overflow-hidden rounded-xl sm:mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={c.name}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="neuro-raised-tint gradient-border edge-lift flex flex-col items-center gap-5 rounded-xl border bg-surface-1 p-7 text-center sm:flex-row sm:p-8 sm:text-left"
              style={{
                "--neuro-base": "var(--color-surface-1)",
                "--tint-color": c.brand,
                borderColor: `${c.brand}40`,
              } as React.CSSProperties}
            >
              <span
                className="inline-flex size-16 shrink-0 items-center justify-center rounded-lg bg-white p-2.5 ring-1"
                style={{ boxShadow: `inset 0 0 0 1px ${c.brand}33` }}
              >
                <Image
                  src={c.logo}
                  alt={`${c.name} logo`}
                  width={140}
                  height={70}
                  unoptimized={c.logo.endsWith(".svg")}
                  className="h-full w-full object-contain"
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <p className="text-card-title font-display font-medium text-ink">{c.name}</p>
                  <span
                    className={cx(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-caption",
                      LEG_CHIP[c.leg],
                    )}
                  >
                    <LegIcon className="size-3" strokeWidth={2} />
                    {c.leg}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink-tertiary">{c.service}</p>
                <p className="mt-2.5 text-body-sm text-ink-subtle">{c.note}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
