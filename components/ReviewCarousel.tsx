"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Quote as QuoteIcon } from "lucide-react";
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
    // No card wrapper — see HowItMoves.tsx's note on flattening the run
    // of identical white bordered cards this page used to stack. A
    // border-t at the call site marks the section boundary instead.
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-body font-medium text-ink md:text-subhead">What clients say</h2>
        <QuoteIcon className="size-5 text-vivid-green/50 md:size-6" strokeWidth={1.6} aria-hidden />
      </div>

      <AnimatePresence mode="wait">
        <motion.figure
          key={index}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: EASE }}
          // Centred/stacked below lg (unchanged) — at lg+ this card sits
          // inside the home page's widened column, and a centred column
          // of content just left empty margins on both sides at that
          // width. A real side-by-side layout (avatar left, copy right,
          // left-aligned) actually uses the width instead of centering
          // inside it.
          className="mt-5 flex flex-col items-center text-center lg:flex-row lg:items-center lg:gap-8 lg:text-left"
        >
          {/* Avatar first, then name, then role, then the quote. A soft
              blurred echo of the same photo sits behind it for depth —
              consistent with the glass/neumorphism treatment used
              everywhere else, not a plain flat circle — and the gradient
              halo ring keys the tone of each reviewer's card. */}
          <span className="relative shrink-0">
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

          {/* No lg:max-w-* cap on this column — a fixed text-width cap
              inside an lg:flex-1 box left the actual words hugging the
              left edge with a wide dead strip to their right (the box
              grew to fill the row, the capped text inside it didn't).
              Letting the blockquote wrap at whatever width the column
              itself has means it genuinely uses the space instead of
              floating in it. */}
          <div className="lg:min-w-0 lg:flex-1">
            <span className="mt-3 block text-body-sm font-medium text-ink md:mt-4 md:text-body lg:mt-0">
              {t.name}
            </span>
            <span className="mt-0.5 block max-w-xs text-caption text-ink-tertiary md:max-w-sm md:text-body-sm lg:max-w-none">
              {t.role}
            </span>

            <blockquote className="mt-4 max-w-sm text-body-sm text-ink-subtle md:mt-5 md:max-w-md md:text-body lg:max-w-none lg:text-body-lg">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
          </div>
        </motion.figure>
      </AnimatePresence>

      {/* Dot nav — also gives manual control over an otherwise
          auto-advancing surface, and pauses the timer via the same
          hover/focus handlers as the card itself. Centred below lg
          (unchanged) but left-aligned under the content column at lg+ —
          centring it under the WHOLE wide card put it under empty space
          to the right of the actual avatar+quote, not under the content
          it actually belongs to. lg:pl-28 clears the md:size-28 avatar
          column + its lg:gap-8 so the dots start at the same left edge
          the name/role/quote text above them does. */}
      <div className="mt-6 flex items-center justify-center gap-1.5 lg:justify-start lg:pl-28">
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
