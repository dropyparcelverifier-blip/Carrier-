"use client";

import { useId } from "react";
import { useReducedMotion } from "motion/react";
import { cx } from "../ui";

/**
 * Small looping motion-graphics moments, built in SVG/CSS rather than
 * embedded Lottie files — LottieFiles' catalog can't be browsed
 * programmatically here (the site blocks automated fetching), and a guessed
 * asset URL risks 404ing or silently loading the wrong animation. These aim
 * for the same felt quality — a light, self-contained looping illustration
 * — without an external, unverifiable dependency.
 */

type IconProps = { className?: string; "aria-hidden"?: boolean };

/** A plane banking around a soft elliptical loop. */
export function FlyingPlane({ className, ...rest }: IconProps) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const pathId = `plane-loop-${uid}`;

  return (
    <svg viewBox="0 0 120 120" className={cx("overflow-visible", className)} {...rest}>
      <defs>
        <path
          id={pathId}
          d="M 60 22 A 38 38 0 1 1 59.9 22"
          fill="none"
        />
      </defs>
      <ellipse
        cx="60"
        cy="60"
        rx="38"
        ry="38"
        fill="none"
        className="stroke-current opacity-15"
        strokeWidth="1.5"
        strokeDasharray="2 6"
        strokeLinecap="round"
      />
      <g>
        <path
          d="M9 0c-2 0-4.4-.3-6-1L-7 -6h-2L-6-1h-3l-1.3-1.6h-1.7l.5 1.6-.5 1.6h1.7L-9 1h3L-7 6h2l10-5c1.6-.7 4-1 6-1z"
          className="fill-current"
          transform="scale(1.3)"
        />
        {!reduce ? (
          <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
            <mpath href={`#${pathId}`} />
          </animateMotion>
        ) : (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0"
            dur="1s"
            repeatCount="1"
          />
        )}
      </g>
    </svg>
  );
}

/** A package that settles in with a soft bounce, then idles. */
export function BouncingPackage({ className, ...rest }: IconProps) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 32 32" className={className} {...rest}>
      <g className={reduce ? undefined : "origin-center animate-[package-bounce_2.6s_ease-in-out_infinite]"}>
        <rect x="6" y="12" width="20" height="14" rx="2" className="fill-current opacity-90" />
        <path d="M6 14l10 5 10-5" fill="none" stroke="var(--color-surface-1)" strokeWidth="1.4" />
        <path d="M16 19v7" stroke="var(--color-surface-1)" strokeWidth="1.4" />
        <path
          d="M9 12l7-4 7 4"
          fill="none"
          className="stroke-current"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** A checkmark that draws itself once, then holds — a "verified" beat. */
export function DrawCheck({ className, ...rest }: IconProps) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 24 24" className={className} {...rest}>
      <circle cx="12" cy="12" r="10" className="fill-current opacity-15" />
      <path
        d="M7 12.5l3.2 3.2L17 9"
        fill="none"
        className="stroke-current"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={reduce ? 0 : 1}
        style={
          reduce
            ? undefined
            : {
                animation: "draw-check 0.6s 0.4s cubic-bezier(0.65,0,0.35,1) forwards",
              }
        }
      />
    </svg>
  );
}
