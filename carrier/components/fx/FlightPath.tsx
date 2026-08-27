"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A consignment hopping from section to section as you scroll.
 *
 * FIRST ATTEMPT WAS WRONG. It drew one continuous arc down the page
 * background and slid a marker along it — a decorative line behind the
 * content, which isn't what was asked for and didn't relate to anything
 * on screen.
 *
 * SECOND ATTEMPT WAS ALSO WRONG, in a way only visible on screen. It kept
 * a trail — a polyline in a `fixed inset-0` viewBox whose y came from a
 * waypoint's INDEX — so the same decorative diagonal was still drawn
 * across the page, now in screen space where it couldn't even scroll with
 * the content it was meant to describe. And the waypoints were a
 * hardcoded array of VIEWPORT percentages (12, 78, 46, ...) while the
 * sections they were supposed to visit live in a centred, max-width
 * column. Two coordinate systems: the aircraft parked in the page margin
 * beside nothing, then on top of a heading. It was never going to line up
 * with a card, at any width, because it was never measuring one.
 *
 * This version has no waypoint table. Every position is measured from the
 * DOM: the aircraft holds a FIXED position on screen while the page
 * scrolls past it, and moves horizontally into whichever side the current
 * section has left CLEAR. A left-offset section clears its right; a
 * right-offset section clears its left; a full-width section clears
 * neither, so the aircraft flies out to the margin and fades — it has
 * left frame, rather than hovering over the content.
 *
 * No animation library. `position: fixed`, one scroll listener throttled
 * to requestAnimationFrame, and CSS transitions for the bank and the
 * fade. Horizontal position is written straight to the node each frame
 * (untransitioned, so it tracks the scroll exactly, and so this doesn't
 * re-render React sixty times a second).
 */

/** Fraction of viewport height the aircraft holds. */
const SIGHTLINE = 0.42;

/** Below this, a "clear" side is too tight to fly through — fade instead. */
const MIN_CLEAR = 150;

/** Keep the airframe (and its glow) off the viewport edges. */
const EDGE_INSET = 46;

type Leg = { x: number; vis: number; bodyTop: number; bodyBottom: number };

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

export default function FlightPath({
  sectionSelector = "[data-leg]",
}: {
  sectionSelector?: string;
}) {
  const [on, setOn] = useState(false);
  const craft = useRef<HTMLDivElement>(null);
  const lastX = useRef(0);
  const heading = useRef(1);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1024px)");
    const decide = () => setOn(!reduce.matches && wide.matches);
    decide();
    reduce.addEventListener("change", decide);
    wide.addEventListener("change", decide);
    return () => {
      reduce.removeEventListener("change", decide);
      wide.removeEventListener("change", decide);
    };
  }, []);

  useEffect(() => {
    if (!on) return;
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(sectionSelector),
    );
    if (sections.length === 0) return;

    let frame = 0;

    /**
     * Where the aircraft belongs while this section owns the viewport, in
     * viewport px. Measured fresh every frame — the offset column is a
     * percentage, images load, and accordions open.
     */
    const measure = (el: HTMLElement): Leg => {
      const sec = el.getBoundingClientRect();
      const body =
        el
          .querySelector<HTMLElement>("[data-leg-body]")
          ?.getBoundingClientRect() ?? sec;
      const align = el.dataset.align ?? "full";
      const vw = window.innerWidth;

      let from: number;
      let to: number;
      if (align === "left") {
        // Content sits left; the clear lane runs from its right edge to
        // the column's.
        from = body.right;
        to = sec.right;
      } else if (align === "right") {
        from = sec.left;
        to = body.left;
      } else {
        // Nothing is clear inside a full-width section. Fly out to the
        // roomier page margin and fade there.
        const leftMargin = sec.left;
        const rightMargin = vw - sec.right;
        from = leftMargin >= rightMargin ? 0 : sec.right;
        to = leftMargin >= rightMargin ? sec.left : vw;
      }

      const clear = to - from;
      return {
        x: (from + to) / 2,
        vis: align === "full" || clear < MIN_CLEAR ? 0 : 1,
        // The BODY's span, not the section's. The aircraft holds its lane
        // for as long as content is under the sightline and crosses only
        // in the padding between one body and the next — so a crossing is
        // always over empty page, never over a card. Interpolating across
        // the whole section instead (what this did first) flew it straight
        // through the middle of Services' own illustrations.
        bodyTop: body.top + window.scrollY,
        bodyBottom: body.bottom + window.scrollY,
      };
    };

    const update = () => {
      frame = 0;
      const node = craft.current;
      if (!node) return;

      const vw = window.innerWidth;
      const line = window.scrollY + window.innerHeight * SIGHTLINE;

      const legs = sections.map(measure);

      // The first leg whose body has not yet passed the sightline. Either
      // the sightline is inside that body (hold its lane) or still above it
      // (cross the gap from the previous body into it).
      let idx = legs.findIndex((l) => line <= l.bodyBottom);
      if (idx === -1) idx = legs.length - 1;

      let from = legs[idx];
      let to = legs[idx];
      let t = 0;
      if (idx > 0 && line < legs[idx].bodyTop) {
        from = legs[idx - 1];
        to = legs[idx];
        const gap = to.bodyTop - from.bodyBottom;
        t = easeInOutCubic(
          gap > 1 ? Math.min(1, Math.max(0, (line - from.bodyBottom) / gap)) : 1,
        );
      }

      const x = Math.max(
        EDGE_INSET,
        Math.min(vw - EDGE_INSET, from.x + (to.x - from.x) * t),
      );
      const vis = from.vis + (to.vis - from.vis) * t;

      // Bank into the turn, and face the direction of travel. Heading comes
      // from the leg-to-leg delta, not the per-frame one, which is
      // sub-pixel noise at either end of a flight — and it must persist
      // through a hold, where there is no delta at all to read it from.
      if (to.x !== from.x) heading.current = to.x >= from.x ? 1 : -1;
      const bank = Math.max(-26, Math.min(26, (x - lastX.current) * 14));
      lastX.current = x;
      const dir = heading.current;

      node.style.left = `${x}px`;
      node.style.opacity = String(vis);
      node.style.transform = `translate(-50%, -50%) rotate(${bank}deg) scaleX(${dir})`;
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [on, sectionSelector]);

  if (!on) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-20 hidden lg:block"
    >
      <div
        ref={craft}
        className="absolute"
        style={{
          left: 0,
          top: `${SIGHTLINE * 100}%`,
          opacity: 0,
          transform: "translate(-50%, -50%)",
          // Only the bank and the fade are eased. Horizontal position is
          // written per frame and must not lag the scroll.
          transition:
            "transform 400ms cubic-bezier(0.22,1,0.36,1), opacity 450ms ease-out",
        }}
      >
        <span className="absolute -inset-6 rounded-full bg-primary/10 blur-md" />
        <svg
          viewBox="0 0 24 24"
          className="relative size-7 text-primary drop-shadow-sm"
          fill="currentColor"
        >
          {/* Nose-right, so the rotation above banks it into the turn. */}
          <path
            d="M22 12 L14.5 15.2 L11.8 22 L9.6 15.6 L2 12 L9.6 8.4 L11.8 2 L14.5 8.8 Z"
            opacity="0.14"
          />
          <path d="M22 12 L6.5 17.5 L8.6 12.8 L2.6 12 L8.6 11.2 L6.5 6.5 Z" />
        </svg>
      </div>
    </div>
  );
}
