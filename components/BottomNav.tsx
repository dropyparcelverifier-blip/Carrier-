"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Calculator, Home, Info, Radar } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cx } from "./ui";

type Tone = "primary" | "blue" | "amber" | "green";

// Same four-tone sequence HowItMoves uses for its journey steps — carrying
// that palette into the tab bar too, so "which tab" and "which stage" read
// as the same colour language rather than every tab defaulting to primary.
const TABS: { href: string; label: string; icon: LucideIcon; tone: Tone }[] = [
  { href: "/", label: "Home", icon: Home, tone: "primary" },
  { href: "/track", label: "Track", icon: Radar, tone: "blue" },
  { href: "/quote", label: "Quote", icon: Calculator, tone: "amber" },
  { href: "/about", label: "About", icon: Info, tone: "green" },
];

const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary",
  blue: "text-vivid-blue",
  amber: "text-vivid-amber",
  green: "text-vivid-green",
};

/**
 * Floating bottom tab bar — the primary navigation surface on mobile,
 * standing in for the desktop top nav's link list and the old hamburger
 * sheet (see TopNav.tsx). Docked flush to the screen edge originally; now
 * an inset island (same footprint TopNav's scrolled pill already uses),
 * so it needed the omnidirectional `.neuro-raised` shadow instead of the
 * edge-only `.neuro-bar` treatment — a bar with visible space on all four
 * sides has no "screen edge" left for `.neuro-bar` to skip.
 *
 * The bottom offset carries the safe-area inset itself (not a `.pb-safe`
 * padding inside the bar) so the gap between the bar and the home
 * indicator grows on notched devices instead of the bar just sitting
 * further from view.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav
      aria-label="Primary"
      // surface-2, not surface-1 — surface-1 sits almost exactly on top of
      // canvas in dark mode (#08090a vs #010102), so a floating panel that
      // shade relied entirely on an 8px soft shadow to read as separated
      // from the page, which wasn't enough. surface-2 plus a real border
      // (not just the neumorphic shadow) gives it an edge that holds up
      // regardless of what's behind it — and gradient-border/edge-lift add
      // the same violet sheen + top highlight every card on the site has.
      className="gradient-border edge-lift [--neuro-base:var(--color-surface-2)] neuro-raised fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 rounded-2xl border border-hairline-strong md:hidden"
    >
      <ul className="flex items-stretch justify-around px-3 py-2">
        {TABS.map(({ href, label, icon: Icon, tone }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-caption transition-colors duration-200 active:scale-95"
              >
                <span className="relative flex size-10 items-center justify-center">
                  {/* Sunken pressed-in shape — layoutId glides it between
                      tabs on route change instead of just popping in/out.
                      Stays neutral (not tinted per-tone) so it reads as
                      "you are here" independent of which colour the
                      icon/label above are carrying. */}
                  {active ? (
                    <motion.span
                      layoutId="bottom-nav-pressed"
                      className="[--neuro-base:var(--color-surface-2)] neuro-pressed-sm absolute inset-0 rounded-full"
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 420, damping: 32 }
                      }
                    />
                  ) : null}
                  <Icon
                    className={cx(
                      "relative size-5 transition-colors duration-200",
                      active ? TONE_TEXT[tone] : "text-ink-tertiary",
                    )}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                </span>
                <span className={active ? cx("font-medium", TONE_TEXT[tone]) : "text-ink-tertiary"}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
