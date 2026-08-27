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
 * This version is what was actually described: the aircraft holds a
 * FIXED position on screen while the page scrolls past it, and moves
 * horizontally between waypoints as each section takes over the
 * viewport — left, then right, then centre. It visits the cards.
 *
 * The trail behind it is the route it has already flown, drawn only as
 * far as it has travelled, so the page reads as a journey in progress
 * rather than a fixed decoration.
 */

/** Horizontal waypoints, as a percentage of viewport width. */
const WAYPOINTS = [12, 78, 46, 84, 24, 62, 16];

export default function FlightPath({ sectionSelector = "[data-leg]" }: { sectionSelector?: string }) {
  const [on, setOn] = useState(false);
  const [x, setX] = useState(WAYPOINTS[0]);
  const [angle, setAngle] = useState(0);
  const [trail, setTrail] = useState<string>("");
  const lastX = useRef(WAYPOINTS[0]);

  useEffect(() => {
    const okMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia("(min-width: 1024px)");
    const decide = () => setOn(okMotion && wide.matches);
    decide();
    wide.addEventListener("change", decide);
    return () => wide.removeEventListener("change", decide);
  }, []);

  useEffect(() => {
    if (!on) return;
    const legs = Array.from(document.querySelectorAll<HTMLElement>(sectionSelector));
    if (legs.length === 0) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      // The aircraft sits at 42% viewport height. Sections are measured
      // against that line, so "which leg am I on" is the leg whose box
      // currently contains it.
      const line = vh * 0.42;

      let idx = 0;
      let within = 0;
      for (let i = 0; i < legs.length; i++) {
        const r = legs[i].getBoundingClientRect();
        if (r.top <= line && r.bottom >= line) {
          idx = i;
          within = (line - r.top) / Math.max(1, r.height);
          break;
        }
        if (r.top > line) break;
        idx = i;
        within = 1;
      }

      // Ease between this waypoint and the next, so the aircraft flies
      // the gap rather than teleporting when a section boundary passes.
      const from = WAYPOINTS[idx % WAYPOINTS.length];
      const to = WAYPOINTS[(idx + 1) % WAYPOINTS.length];
      // easeInOutCubic — it accelerates out of one card and settles into
      // the next, which reads as flight rather than a slider.
      const t = within < 0.5 ? 4 * within ** 3 : 1 - (-2 * within + 2) ** 3 / 2;
      const nx = from + (to - from) * t;

      // Bank into the turn. Clamped so it never points straight down.
      const delta = nx - lastX.current;
      lastX.current = nx;
      setAngle(Math.max(-28, Math.min(28, delta * 14)));
      setX(nx);

      // Trail: the waypoints already passed, plus the current position.
      const pts = WAYPOINTS.slice(0, idx + 1).map(
        (p, i) => `${p},${(i / (WAYPOINTS.length - 1)) * 100}`,
      );
      pts.push(`${nx},${((idx + within) / (WAYPOINTS.length - 1)) * 100}`);
      setTrail(pts.join(" "));
    };

    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
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
    <div aria-hidden className="pointer-events-none fixed inset-0 z-20 hidden lg:block">
      <div
        className="absolute"
        style={{
          left: `${x}%`,
          top: "42%",
          transform: `translate(-50%, -50%) rotate(${angle}deg)`,
          transition: "transform 400ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <span className="absolute -inset-6 rounded-full bg-primary/8 blur-md" />
        <svg viewBox="0 0 24 24" className="relative size-7 text-primary drop-shadow-sm" fill="currentColor">
          {/* Nose-right, so the rotation above banks it into the turn. */}
          <path d="M22 12 L14.5 15.2 L11.8 22 L9.6 15.6 L2 12 L9.6 8.4 L11.8 2 L14.5 8.8 Z" opacity="0.14" />
          <path d="M22 12 L6.5 17.5 L8.6 12.8 L2.6 12 L8.6 11.2 L6.5 6.5 Z" />
        </svg>
      </div>
      {trail && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full opacity-25">
          <polyline
            points={trail}
            fill="none"
            className="stroke-primary"
            strokeWidth="0.35"
            strokeDasharray="1.2 1.8"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
}
