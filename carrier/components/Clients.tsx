





"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, MapPin } from "lucide-react";
import { CLIENTS, type Client } from "@/lib/clients";
import { EASE, VIEWPORT } from "./motion/primitives";
import { cx } from "./ui";

/* ------------------------------------------------------------------ */
/* Strip — one client at a time, auto-advancing, rather than the       */
/* continuous marquee this used to be. A six-logo scroll is easy to    */
/* tune out; a single card that changes lets each client's own colour  */
/* actually register instead of blurring past in a row of six others.  */
/* ------------------------------------------------------------------ */

const STRIP_STEP_MS = 4000;

export function ClientStrip({ wide = false }: { wide?: boolean } = {}) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % CLIENTS.length);
    }, STRIP_STEP_MS);
    return () => clearInterval(id);
  }, [reduce, paused]);

  const c = CLIENTS[index];

  return (
    <div
      // max-w-2xl is the original cap (kept as the /about default — that
      // page's own Container is already the site's wide standard, so this
      // stays a deliberately focused card within it, not the whole row).
      // `wide` opts out for contexts with a genuinely narrower container
      // of their own — the Home page's column, where this cap used to be
      // a no-op at the old narrower width but started leaving real dead
      // space on both sides once that column widened.
      className={wide ? "mx-auto max-w-none" : "mx-auto max-w-2xl"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/*
        Neumorphic tray — the whole roster sits recessed inside one shelf
        rather than a loose logo row floating above an unrelated card, so
        the section reads as one object. The colour wash behind it shifts
        to the active client's own brand colour (a plain background-color
        transition on its own layer, not fighting the tray's box-shadow),
        and the active logo presses IN while the spotlight card below
        pops UP — the same raised/pressed vocabulary BottomNav already
        uses for "which tab is selected", reused here for "which client".
      */}
      <div
        className="neuro-pressed relative overflow-hidden rounded-2xl border border-hairline-tertiary p-5 sm:p-8"
        style={{ "--neuro-base": "var(--color-canvas)" } as React.CSSProperties}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-colors duration-700"
          style={{
            background: `radial-gradient(65% 55% at 50% 0%, ${c.brandColor}16, transparent 72%)`,
          }}
        />

        {/* Logo row — the whole roster at a glance, not just whichever one
            the 4s timer happens to be on. Doubles as the nav (tap a mark
            to jump straight to it). Border colour (not box-shadow) carries
            the active tint, so it composes safely with the neuro-* classes'
            own box-shadow instead of silently replacing it.
            max-w-lg (tighter than CarrierStrip's max-w-3xl — only 7
            clients exist vs. 11 carriers, so the wider cap still left
            visible gaps either side of this shorter row) caps just this
            row — at `wide`, centring the same natural-width cluster of
            chips in a much wider box just added empty space instead of
            using it. */}
        <div className="relative mx-auto flex max-w-lg flex-wrap items-center justify-center gap-3">
          {CLIENTS.map((client, i) => (
            <button
              key={client.name}
              type="button"
              aria-label={`Show ${client.name}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cx(
                "[--neuro-base:var(--color-canvas)] flex size-14 shrink-0 items-center justify-center rounded-xl border-2 border-transparent transition-all duration-300",
                i === index
                  ? "neuro-pressed-sm"
                  : "neuro-raised opacity-55 grayscale-[0.4] hover:-translate-y-0.5 hover:opacity-90 hover:grayscale-0",
              )}
              style={i === index ? { borderColor: `${client.brandColor}70` } : undefined}
            >
              <Mark client={client} size="row" />
            </button>
          ))}
        </div>

        {/* Spotlight card — raised up out of the pressed-in tray. */}
        <div className="relative mt-6 overflow-hidden rounded-xl sm:mt-8">
          <AnimatePresence mode="wait">
            {/* A real link out to the client's own site now, not an inert
                card — these are named, credited relationships (see the
                provenance note on Mark below), so linking out is the same
                trust move ClientGrid further down the page already makes;
                the spotlight card just didn't carry it before. */}
            <motion.a
              key={c.name}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ duration: 0.45, ease: EASE }}
              // .neuro-raised-tint (globals.css) composes the neumorphic
              // shadow AND the colour glow into one box-shadow value,
              // reading the colour from --tint-color — a plain `boxShadow`
              // inline style here would silently replace the whole
              // neumorphic shadow instead of adding to it, since inline
              // styles always win over any class. --neuro-base is set to
              // surface-1 here (one level up from the tray's own canvas
              // base) so the card visibly separates from the shelf it's
              // sitting in. gradient-border/edge-lift are pseudo-element
              // based, so they compose safely on top rather than fighting
              // neuro-raised-tint's own shadow — same combo BottomNav/
              // TopNav already use.
              className="neuro-raised-tint gradient-border edge-lift group flex flex-col items-center gap-5 rounded-xl border bg-surface-1 p-7 text-center transition-transform duration-300 hover:-translate-y-0.5 sm:flex-row sm:p-8 sm:text-left"
              style={{
                "--neuro-base": "var(--color-surface-1)",
                "--tint-color": c.brandColor,
                borderColor: `${c.brandColor}40`,
              } as React.CSSProperties}
            >
              <Mark client={c} size="card" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-center gap-1.5 sm:justify-start">
                  <p className="text-card-title font-display font-medium text-ink">{c.name}</p>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-ink-tertiary opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    strokeWidth={2}
                  />
                </div>
                <p className="mt-1.5 flex items-center justify-center gap-1 text-caption text-ink-tertiary sm:justify-start">
                  <MapPin className="size-3" strokeWidth={1.8} />
                  {c.city}
                </p>
                <p className="mt-3 text-body-sm text-ink-subtle">{c.focus}</p>
              </div>
            </motion.a>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/**
 * Client logo, falling back to an initials monogram tinted with the
 * client's own brand colour when no logo is set.
 *
 * Logo files under /public/clients are each client's registered trademark —
 * sourced from Wikimedia Commons or the client's own site (see lib/clients.ts
 * for provenance per file) for a genuine, named business relationship. This
 * repo is public, so before shipping, confirm each logo's licence permits
 * redistribution and that displaying it doesn't overstate the relationship —
 * drop the `logo` field for any client where that isn't true and it falls
 * straight back to the initials mark, which needs no such clearance.
 */
function Mark({
  client,
  size,
}: {
  client: Client;
  size: "card" | "row";
}) {
  const isCard = size === "card";

  if (client.logo) {
    return (
      <span
        aria-hidden
        className={cx(
          "inline-flex shrink-0 items-center justify-center rounded-md border overflow-hidden",
          isCard ? "size-20 p-2.5" : "size-12 p-2",
        )}
        style={{
          borderColor: `${client.brandColor}44`,
          // Fixed white, not theme-driven: most real logos (esp. these —
          // dark strokes) are drawn for a light backing and go near-invisible
          // on the dark canvas's near-black surfaces. A steady white chip
          // keeps every logo legible in both themes without per-logo tuning.
          backgroundColor: "#ffffff",
        }}
      >
        <img
          src={client.logo}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain"
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = "none";
            const span = document.createElement("span");
            span.className = `font-display font-semibold text-ink ${isCard ? "text-body" : "text-caption"}`;
            span.textContent = client.mark;
            el.parentElement?.appendChild(span);
          }}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-md border font-display font-semibold",
        // Matches the logo branch's box exactly (size-20 / size-12) so a
        // monogram card and a logo card are the same size and shape.
        isCard ? "size-20 text-headline" : "size-12 text-body",
      )}
      style={{
        borderColor: `${client.brandColor}66`,
        backgroundColor: `${client.brandColor}24`,
      }}
    >
      <span className="text-ink">{client.mark}</span>
    </span>
  );
}
/* ------------------------------------------------------------------ */
/* Marquee                                                             */
/* ------------------------------------------------------------------ */

function MarqueeRow({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <ul
      className="flex shrink-0 items-center gap-5 pr-5"
      aria-hidden={ariaHidden || undefined}
    >
      {CLIENTS.map((c) => (
        <li key={c.name}>
          {/*
            Each chip carries the client's own colour on its border and
            shadow, not the one flat hairline every chip shared before — the
            monogram already sits in a coloured tile, and a neutral border
            around it read as an afterthought rather than a designed unit.
          */}
          <span
            className="group flex items-center gap-3 rounded-full border bg-surface-1 py-3 pr-6 pl-3 whitespace-nowrap shadow-sm transition-shadow duration-300 hover:shadow-md"
            style={{
              borderColor: `${c.brandColor}3d`,
              boxShadow: `0 1px 2px rgb(0 0 0 / 0.04), 0 0 0 1px ${c.brandColor}14`,
            }}
          >
            <Mark client={c} size="row" />
            <span className="text-body-sm font-medium text-ink-muted transition-colors duration-300 group-hover:text-ink">
              {c.name}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ClientMarquee() {
  return (
    <div className="relative overflow-hidden py-2">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-canvas to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-canvas to-transparent" />

      {/*
        FOUR identical rows, animated by -50% (i.e. two rows' width).

        Two rows is the obvious implementation and it breaks: -50% shifts by a
        single row, and six chips measure ~1380px — narrower than most
        viewports — so at the loop point the content ends before the right edge
        and a gap appears. Four rows means the translated half is ~2760px wide,
        which covers any realistic screen.

        Each row carries its trailing gap as `pr-4` so the halves are exactly
        equal; putting the duplicates inside one flex row would add an extra
        gap and reintroduce a jump.
      */}
      <div className="marquee-track flex w-max">
        <MarqueeRow />
        <MarqueeRow ariaHidden />
        <MarqueeRow ariaHidden />
        <MarqueeRow ariaHidden />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Grid                                                                */
/* ------------------------------------------------------------------ */

export function ClientGrid() {
  const reduce = useReducedMotion();

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {CLIENTS.map((client, i) => (
        <motion.a
          key={client.name}
          href={client.href}
          target="_blank"
          rel="noopener noreferrer"
          className="gradient-border edge-lift spotlight group relative flex flex-col overflow-hidden rounded-lg bg-surface-1 p-6 shadow-md transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-xl md:p-7"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.6, delay: i * 0.06, ease: EASE }}
        >
          {/* the client's own colour, keyed down the left edge */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 z-[2] w-[3px]"
            style={{ backgroundColor: client.brandColor }}
          />
          {/* and a wash of it on hover */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background: `radial-gradient(90% 60% at 0% 0%, ${client.brandColor}1f, transparent 70%)`,
            }}
          />

          <div className="relative z-[1] flex items-start justify-between gap-4">
            <Mark client={client} size="card" />
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-full border border-hairline bg-surface-2 text-ink-tertiary transition-all duration-500 group-hover:text-ink"
            >
              <ArrowUpRight
                className="size-4 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.9}
              />
            </span>
          </div>

          <h3 className="relative z-[1] mt-6 font-display text-card-title text-ink">
            {client.name}
          </h3>
          <p className="relative z-[1] mt-2 flex-1 text-body-sm text-ink-subtle">
            {client.focus}
          </p>

          <div className="relative z-[1] mt-6 flex items-center justify-between gap-3 border-t border-hairline pt-4">
            <span className="truncate font-mono text-[11px] text-ink-tertiary transition-colors duration-500 group-hover:text-ink-subtle">
              {client.domain}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-caption text-ink-tertiary">
              <MapPin className="size-3" strokeWidth={1.8} />
              {client.city}
            </span>
          </div>
        </motion.a>
      ))}
    </div>
  );
}
