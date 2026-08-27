"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Radar } from "lucide-react";
import { usePathname } from "next/navigation";
import Wordmark from "./Wordmark";
import ThemeToggle from "./fx/ThemeToggle";
import { ButtonLink, Container, cx } from "./ui";
import { EASE } from "./motion/primitives";
import Link from "next/link";
import { TRACKING_ORIGIN } from "@/lib/tracking-site";

/**
 * One entry per page, not per section — this site is five separate pages
 * (Home / About / Quote / Contact / Track), each with its own sections, not
 * one long scroll with anchors. Anchor links here used to jump between /,
 * /about and /quote inconsistently (three different destinations for four
 * labels), which read as random navigation rather than a menu. Track
 * stays a standalone CTA button instead of a link here — it's the one
 * action visitors reach for from every page, not a page to browse to.
 */
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/quote", label: "Get a quote" },
  { href: "/contact", label: "Contact" },
];

/**
 * Desktop keeps the full link nav. On mobile, BottomNav.tsx is the primary
 * navigation surface, so this collapses to a slim safe-area-aware app bar —
 * just the wordmark and theme toggle, no hamburger/sheet.
 */
export default function TopNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="pt-safe fixed inset-x-0 top-0 z-50 pt-4 md:pt-5">
      <Container>
        <nav
          className={cx(
            // Neumorphic, not glass, to match BottomNav: an opaque
            // surface-2 shelf (not surface-1, which is nearly the same
            // tone as canvas in dark mode) with a soft shadow, a real
            // border, AND the same violet gradient-border sheen every
            // card on the site uses — floating above scrolled content
            // instead of blurring through it, and reading as the same
            // material as everything else rather than a one-off.
            // gap/padding tighten on the narrowest phones. At 320 the
            // wordmark, the Track button and the theme toggle summed to a
            // fixed 317px inside a 248px content box, so the cluster ran
            // 34px off the right edge — and because html/body carry
            // overflow-x:hidden it clipped silently instead of scrolling,
            // leaving 9.6px of the 44px toggle tappable.
            "flex h-16 items-center justify-between gap-2 rounded-xl px-3 transition-all duration-500 ease-out sm:gap-4 sm:px-4 md:px-5",
            scrolled
              ? "gradient-border edge-lift [--neuro-base:var(--color-surface-2)] neuro-raised border border-hairline-strong"
              // Not fully transparent even pre-scroll — a bare wordmark
              // over an arbitrary hero (About's photo, for one) can't rely
              // on every hero's own scrim being tuned for the ~64px band
              // this bar occupies. A light scrim + blur keeps the wordmark
              // legible everywhere without waiting for the scroll trigger.
              : "border border-transparent bg-canvas/35 backdrop-blur-sm",
          )}
        >
          {/* The name lockup is the one thing here that can go: the mark
              still links home and the link's aria-label still reads the full
              company name. Everything else is a 44px tap target. */}
          <Wordmark lockupClassName="hidden min-[400px]:flex" />

          {/* desktop links with a sliding hover pill */}
          <ul
            className="hidden items-center gap-1 md:flex"
            onMouseLeave={() => setHovered(null)}
          >
            {LINKS.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
              <li key={link.href} className="relative">
                <Link
                  href={link.href}
                  onMouseEnter={() => setHovered(link.href)}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative block rounded-md px-3.5 py-2 text-body-sm transition-colors duration-200 hover:text-primary",
                    active ? "text-ink font-medium" : "text-ink-subtle",
                  )}
                >
                  {hovered === link.href ? (
                    <motion.span
                      layoutId="nav-hover"
                      className="absolute inset-0 rounded-md border border-primary/20 bg-primary/10"
                      transition={{ duration: 0.28, ease: EASE }}
                    />
                  ) : null}
                  <span className="relative">{link.label}</span>
                </Link>
              </li>
              );
            })}
          </ul>

          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <ButtonLink href={TRACKING_ORIGIN} variant="secondary" size="sm" icon={Radar}>
              Track
            </ButtonLink>
          </div>

          {/* mobile: no hamburger/sheet — BottomNav owns general navigation,
              but tracking is the single most-reached-for action on this
              site, so it also gets a direct header shortcut rather than
              making a visitor scroll attention down to the tab bar. */}
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <ButtonLink href={TRACKING_ORIGIN} variant="secondary" size="sm" icon={Radar}>
              Track
            </ButtonLink>
            <ThemeToggle />
          </div>
        </nav>
      </Container>
    </header>
  );
}
