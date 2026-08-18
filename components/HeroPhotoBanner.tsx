


"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { IMAGES, type ImageKey } from "@/lib/images";
import { cx, StatusBadge } from "./ui";

// A spread of the shipping journey — air, port, warehouse, road — rather
// than one static frame. distributionFloor is deliberately left out: it's
// already the About-teaser photo further down this same page, and reusing
// it here would put the same image on screen twice.
const SLIDES: ImageKey[] = ["aircraftWing", "containerPort", "warehouseAisle", "truck"];

const STEP_MS = 5000;

/**
 * The hero banner, auto-cycling through SLIDES — same crossfade/pause/dot-nav
 * pattern as ReviewCarousel and ClientStrip, just applied to a background
 * photo instead of a card's content. Split out from app/page.tsx (a server
 * component, for the `metadata` export) since the interval/pause state here
 * needs a client component.
 */
export default function HeroPhotoBanner() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [reduce, paused]);

  const key = SLIDES[index];
  const slide = IMAGES[key];

  return (
    <div
      className="relative h-56 w-full overflow-hidden rounded-2xl border border-hairline shadow-lg sm:h-64"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AnimatePresence>
        <motion.div
          key={key}
          className="absolute inset-0"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <Image
            src={slide.src}
            alt=""
            aria-hidden
            fill
            priority={index === 0}
            sizes="(max-width: 480px) 100vw, 480px"
            className="photo object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/*
        Headline sits directly on the photo. The risk with that (tuning a
        scrim's opacity to guarantee AA against an arbitrary photo is
        fragile — see the old Hero.tsx history) is handled the same way the
        About page's CTA band handles it: the scrim is CANVAS itself, not
        an arbitrary tint, opaque enough at the bottom that the text is
        effectively sitting on a normal canvas background with a photo
        fading in above it, not the other way around. A single scrim layer
        works across every slide since they're all similarly-toned
        logistics photography, not arbitrary user content.
      */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-canvas from-5% via-canvas/50 via-45% to-transparent to-85%" />
      <div className="absolute inset-x-5 bottom-5 z-[1] flex flex-col items-start gap-3">
        <StatusBadge tone="success" pulse>
          Shipping from Global to India daily
        </StatusBadge>
        <h1 className="max-w-md font-display text-[clamp(26px,7vw,40px)] leading-[1.1] font-semibold tracking-[-0.03em] text-ink text-balance">
          Your Global order, tracked to your doorstep.
        </h1>
      </div>

      {/* Dot nav — manual control over the auto-advancing background,
          same as ReviewCarousel/ClientStrip. min-h-11 hit area even
          though the visible dot stays small, so it's actually tappable
          over a photo on a phone. */}
      <div className="absolute top-2 right-2 z-[1] flex items-center gap-0.5">
        {SLIDES.map((s, i) => (
          <button
            key={s}
            type="button"
            aria-label={`Show background ${i + 1} of ${SLIDES.length}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className="flex min-h-11 min-w-6 items-center justify-center"
          >
            <span
              className={cx(
                "block h-1.5 rounded-full bg-white shadow-sm transition-all duration-300",
                i === index ? "w-5 opacity-95" : "w-1.5 opacity-50",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
