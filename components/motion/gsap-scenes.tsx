"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cx } from "../ui";

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/* PerspectivePanel — the product panel tilts up into place on scroll   */
/* ------------------------------------------------------------------ */

export function PerspectivePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mm = gsap.matchMedia();

    // Only run the scrub on pointer-capable, motion-tolerant, wide viewports.
    mm.add(
      {
        motionOk: "(prefers-reduced-motion: no-preference)",
        isWide: "(min-width: 768px)",
      },
      (ctx) => {
        const { motionOk, isWide } = ctx.conditions as Record<string, boolean>;
        if (!motionOk || !isWide) return;

        gsap.fromTo(
          el,
          { rotateX: 14, scale: 0.93, y: 40, opacity: 0.4 },
          {
            rotateX: 0,
            scale: 1,
            y: 0,
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top 92%",
              end: "top 42%",
              scrub: 0.6,
            },
          },
        );
      },
    );

    return () => mm.revert();
  }, []);

  return (
    <div style={{ perspective: 1400 }} className={className}>
      <div ref={ref} style={{ transformStyle: "preserve-3d" }}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SplitHeadline — word-by-word rise on mount                          */
/* ------------------------------------------------------------------ */

export function SplitHeadline({
  text,
  className,
  wordClassName,
}: {
  text: string;
  className?: string;
  /** Applied to specific words for emphasis, keyed by index. */
  wordClassName?: (word: string, index: number) => string | undefined;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const words = text.split(" ");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        el.querySelectorAll("[data-word] > span"),
        { yPercent: 55, opacity: 0, filter: "blur(6px)" },
        {
          yPercent: 0,
          opacity: 1,
          filter: "blur(0px)",
          duration: 0.95,
          stagger: 0.05,
          ease: "expo.out",
          delay: 0.05,
        },
      );
    });

    return () => mm.revert();
  }, [text]);

  return (
    <h1 ref={ref} className={className}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} data-word className="inline-block">
          <span className={cx("inline-block", wordClassName?.(word, i))}>
            {word}
          </span>
          {i < words.length - 1 ? <span className="inline-block">&nbsp;</span> : null}
        </span>
      ))}
    </h1>
  );
}

/* ------------------------------------------------------------------ */
/* DrawLine — the vertical timeline rule draws itself as you scroll     */
/* ------------------------------------------------------------------ */

export function DrawLine({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        el,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          transformOrigin: "top center",
          scrollTrigger: {
            trigger: el.parentElement,
            start: "top 80%",
            end: "bottom 60%",
            scrub: 0.5,
          },
        },
      );
    });

    return () => mm.revert();
  }, []);

  return <span ref={ref} aria-hidden className={className} />;
}
