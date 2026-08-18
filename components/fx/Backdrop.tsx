"use client";

import { cx } from "../ui";
import { useOffscreenPause } from "./useOffscreenPause";

/**
 * Layered page backdrop: drifting aurora blobs, a blueprint grid, and film
 * grain so the gradients never band. Purely decorative, never interactive.
 *
 * The blur radius is the dominant cost here — a 110-130px blur repaints a
 * huge kernel every animation frame, and it scales with on-screen pixels, so
 * mobile viewports (where the blob is proportionally just as large but the
 * device is far weaker) pay the most for the least visual benefit. Blur is
 * cut roughly in half below `md`. Animation is paused outright once the
 * section is a full viewport out of view, via `useOffscreenPause`.
 */
export default function Backdrop({
  variant = "hero",
  className,
}: {
  variant?: "hero" | "soft";
  className?: string;
}) {
  const { ref, active } = useOffscreenPause<HTMLDivElement>();

  return (
    <div
      ref={ref}
      aria-hidden
      className={cx(
        "noise pointer-events-none absolute inset-0 overflow-hidden",
        !active && "[&_[class*=aurora-]]:[animation-play-state:paused]",
        className,
      )}
    >
      {/* grid */}
      <div className="grid-bg absolute inset-0" />

      {/* aurora */}
      <div
        className={cx(
          "aurora-a absolute rounded-full blur-[60px] md:blur-[110px]",
          variant === "hero"
            ? "-top-40 -left-24 size-[42rem] bg-primary/22"
            : "-top-32 left-1/4 size-[30rem] bg-primary/12",
        )}
      />
      <div
        className={cx(
          "aurora-b absolute rounded-full blur-[65px] md:blur-[120px]",
          variant === "hero"
            ? "top-10 right-[-10rem] size-[36rem] bg-primary-deep/25"
            : "right-0 -bottom-24 size-[26rem] bg-primary-deep/12",
        )}
      />
      {variant === "hero" ? (
        <div className="aurora-a absolute top-64 left-1/3 size-[28rem] rounded-full bg-accent/8 blur-[70px] md:blur-[130px]" />
      ) : null}

      {/* fade to canvas at the bottom edge */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-canvas" />
    </div>
  );
}
