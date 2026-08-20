"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Quote as QuoteIcon, Star } from "lucide-react";
import { AVATAR_GRADIENT, TESTIMONIALS } from "./Testimonials";
import { EASE } from "./motion/primitives";
import { cx } from "./ui";

const STEP_MS = 4500;

/**
 * One review at a time, auto-advancing, looping forever — a carousel
 * rather than Testimonials.tsx's full grid, which is the right call for
 * the home screen (compact, one card) but the wrong call for /about
 * (where all six should be scannable at once, not gated behind a timer).
 * Both read from the same TESTIMONIALS/AVATAR_GRADIENT source in
 * Testimonials.tsx — role-based names and stock photos, not real customers;
 * replace with sourced quotes before this goes in front of a customer.
 */
export default function ReviewCarousel() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % TESTIMONIALS.length);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [reduce, paused]);

  const t = TESTIMONIALS[index];

  return (
    <div
      className="gradient-border edge-lift relative overflow-hidden rounded-xl border border-hairline bg-surface-1 p-6 shadow-lg sm:p-7 md:p-9"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-body font-medium text-ink md:text-subhead">What customers say</h2>
        <QuoteIcon className="size-5 text-ink-tertiary/40 md:size-6" strokeWidth={1.6} aria-hidden />
      </div>

      <AnimatePresence mode="wait">
        <motion.figure
          key={index}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-5 flex flex-col items-center text-center"
        >
          {/* Avatar first, then name, then role, then the quote. A soft
              blurred echo of the same photo sits behind it for depth —
              consistent with the glass/neumorphism treatment used
              everywhere else, not a plain flat circle — and the gradient
              halo ring keys the tone of each reviewer's card. */}
          <span className="relative">
            <img
              src={t.avatar}
              alt=""
              aria-hidden
              className="absolute inset-0 -z-10 size-20 scale-125 rounded-full object-cover opacity-40 blur-lg md:size-28"
            />
            <span
              className="flex size-20 shrink-0 rounded-full p-[3px] shadow-md md:size-28 md:p-1"
              style={{ backgroundImage: AVATAR_GRADIENT[t.tone] }}
            >
              <span className="size-full overflow-hidden rounded-full ring-2 ring-surface-1">
                <img
                  src={t.avatar}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </span>
            </span>
          </span>

          <span className="mt-3 block text-body-sm font-medium text-ink md:mt-4 md:text-body">
            {t.name}
          </span>
          <span className="mt-0.5 block max-w-xs text-caption text-ink-tertiary md:max-w-sm md:text-body-sm">
            {t.role}
          </span>

          <div className="mt-3 flex items-center gap-1 md:mt-4">
            {Array.from({ length: 5 }).map((_, si) => (
              <Star
                key={si}
                className="size-3.5 fill-vivid-amber text-vivid-amber md:size-4"
                strokeWidth={1.8}
              />
            ))}
          </div>

          <blockquote className="mt-4 max-w-sm text-body-sm text-ink-subtle md:mt-5 md:max-w-md md:text-body">
            &ldquo;{t.quote}&rdquo;
          </blockquote>
        </motion.figure>
      </AnimatePresence>

      {/* Dot nav — also gives manual control over an otherwise
          auto-advancing surface, and pauses the timer via the same
          hover/focus handlers as the card itself. */}
      <div className="mt-6 flex items-center justify-center gap-1.5">
        {TESTIMONIALS.map((item, i) => (
          <button
            key={item.name + i}
            type="button"
            aria-label={`Show review from ${item.name}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className="flex min-h-11 min-w-6 items-center justify-center"
          >
            <span
              className={cx(
                "block h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-5 bg-primary" : "w-1.5 bg-hairline-strong",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
