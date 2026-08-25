"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import {
  Boxes,
  CalendarClock,
  FileCheck2,
  Radar,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { IMAGES } from "@/lib/images";
import { STAGES } from "@/lib/types";
import { EASE, VIEWPORT } from "./motion/primitives";
import { IconTile, cx } from "./ui";

/*
 * Neumorphic instead of the bordered-card look every other grid on the
 * page uses — `neuro-raised` needs the tile to sit at the exact canvas
 * colour (not `bg-surface-1`) so its dual shadow reads as the card being
 * pressed up out of the page rather than a separate panel on top of it;
 * `gradient-border` and a hard `shadow-md` would fight that illusion, so
 * both drop here specifically.
 */
const cell =
  "neuro-raised spotlight group relative overflow-hidden rounded-lg transition-all duration-500 ease-out hover:-translate-y-1";

function Body({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-body-sm text-ink-subtle">{children}</p>;
}

export default function BentoFeatures() {
  const reduce = useReducedMotion();

  const rise = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 22 },
    whileInView: { opacity: 1, y: 0 },
    viewport: VIEWPORT,
    transition: { duration: 0.65, delay: i * 0.06, ease: EASE },
  });

  return (
    <div className="grid gap-4 md:grid-cols-6">
      {/* ---- wide: one number, whole journey ---- */}
      <motion.article
        {...rise(0)}
        className={cx(cell, "md:col-span-4 md:row-span-2")}
      >
        <div className="relative z-[1] flex h-full flex-col p-6 md:p-8">
          <IconTile icon={Radar} tone="blue" />
          <h3 className="mt-5 font-display text-card-title text-ink">
            One number for the whole journey
          </h3>
          <Body>
            Origin warehouse, export clearance, the air leg, Mumbai customs,
            the Vashi bonded floor and QC sign-off — the same 13-stage
            record from order placed to approved, on the tracking ID you
            already have.
          </Body>

          {/* live scan feed — same stage set the real tracker uses
              (lib/types.ts STAGES, lib/admin-stages.ts locations), not an
              invented parallel pipeline with its own made-up codes. */}
          <ul className="mt-7 flex flex-col gap-px overflow-hidden rounded-md border border-hairline">
            {[
              {
                id: "DRP-2026-3182",
                label: "Indian customs clearance · Sahar Air Cargo Complex",
                time: "26 Jul · 08:10",
                tone: "bg-primary",
              },
              {
                id: "DRP-2026-3179",
                label: "Export clearance complete · JFK / EWR Airport",
                time: "26 Jul · 10:05",
                tone: "bg-primary",
              },
              {
                id: "DRP-2026-3141",
                label: "Quality check approved · Vashi warehouse",
                time: "08 Jul · 12:55",
                tone: "bg-semantic-success",
              },
            ].map((row) => (
              // Deliberately not animated. These sit inside a cell that
              // already reveals on scroll; a nested whileInView can miss its
              // intersection on a fast scroll and then stays at opacity 0
              // forever, because `once: true` never re-checks.
              <li
                key={row.id}
                className="flex items-center gap-3 bg-surface-2 px-3.5 py-2.5"
              >
                <span className={cx("size-1.5 shrink-0 rounded-full", row.tone)} />
                <span className="font-mono text-[11px] text-ink-subtle">
                  {row.id}
                </span>
                <span className="min-w-0 flex-1 truncate text-caption text-ink-muted">
                  {row.label}
                </span>
                <span className="hidden font-mono text-[11px] whitespace-nowrap text-ink-tertiary sm:block">
                  {row.time}
                </span>
              </li>
            ))}
          </ul>

          {/* inline stage rail — genuinely pulled from lib/types.ts STAGES'
              `short` labels (not a hand-typed copy that can drift the way
              this list previously did: it still said "US Cleared" and
              skipped a stage after STAGES' own labels were genericized for
              non-US origins). Condensed to every stage from "processing"
              on, dropping "order_placed" itself since the card's own scan
              feed above already shows an order-placed-adjacent entry. */}
          <div className="mt-auto pt-7">
            {/* Below `lg` there's no room for every label next to its bar,
                so the current stage is called out once instead of dropped
                silently — unlabeled ticks told a mobile reader nothing. */}
            <p className="mb-2 text-[11px] text-ink-subtle lg:hidden">
              Currently: <span className="text-ink">In transit</span>
            </p>
            <div className="flex items-center gap-1.5">
              {STAGES.slice(1).map((s, i) => (
                <div key={s.key} className="flex flex-1 flex-col gap-2">
                  {/* static for the same reason as the scan rows above */}
                  <span
                    className={cx(
                      "h-1 rounded-full",
                      i <= 4 ? "bg-primary" : "bg-surface-3",
                    )}
                  />
                  <span
                    className={cx(
                      "hidden text-[10px] lg:block",
                      i <= 4 ? "text-ink-subtle" : "text-ink-tertiary",
                    )}
                  >
                    {s.short}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.article>

      {/* ---- tall image: compliance ---- */}
      <motion.article {...rise(1)} className={cx(cell, "md:col-span-2 md:row-span-2")}>
        <div className="relative h-44 overflow-hidden md:h-52">
          <Image
            src={IMAGES.supplements.src}
            alt={IMAGES.supplements.alt}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="photo object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-105"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-canvas to-transparent" />
        </div>
        <div className="relative z-[1] p-6">
          <IconTile icon={ShieldCheck} tone="violet" />
          <h3 className="mt-5 font-display text-card-title text-ink">
            CDSCO &amp; FSSAI, handled
          </h3>
          <Body>
            Cosmetic import registration under the Cosmetics Rules 2020, and
            FSSAI clearance for nutraceuticals. We check your registration
            covers the SKU list before the order ships — not after it lands.
          </Body>
        </div>
      </motion.article>

      {/* ---- shelf life ---- */}
      <motion.article {...rise(2)} className={cx(cell, "md:col-span-3")}>
        <div className="relative z-[1] p-6">
          <IconTile icon={CalendarClock} tone="amber" />
          <h3 className="mt-5 font-display text-card-title text-ink">
            Shelf life checked at origin
          </h3>
          <Body>
            Batch dates verified at origin, so short-dated stock never
            becomes a customs argument on arrival.
          </Body>
        </div>
      </motion.article>

      {/* ---- landed cost ---- */}
      <motion.article {...rise(3)} className={cx(cell, "md:col-span-3")}>
        <div className="relative z-[1] p-6">
          <IconTile icon={FileCheck2} tone="green" />
          <h3 className="mt-5 font-display text-card-title text-ink">
            Landed cost before it lands
          </h3>
          <Body>
            Duty, surcharge and IGST computed at booking against your HS code,
            then reconciled with the real assessment.
          </Body>
        </div>
      </motion.article>

      {/* ---- wide image: exceptions ---- */}
      <motion.article {...rise(4)} className={cx(cell, "md:col-span-3")}>
        <div className="relative z-[1] flex h-full flex-col p-6 md:p-8">
          <IconTile icon={TriangleAlert} tone="coral" />
          <h3 className="mt-5 font-display text-card-title text-ink">
            Exceptions reach a human
          </h3>
          <Body>
            Customs holds, label queries and rolled sailings raise an exception
            on the shipment and route straight to your named clearance agent —
            with the clock visible on the record, not buried in an inbox.
          </Body>

          <div className="mt-6 rounded-md border border-hairline-strong bg-surface-2 p-3">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-accent" />
              <span className="font-mono text-[11px] text-ink-muted">
                CRR-4610-US
              </span>
              <span className="text-[11px] text-ink-tertiary">
                · Mundra Customs
              </span>
            </div>
            <p className="mt-1.5 text-caption text-ink-subtle">
              Country-of-origin declaration queried on 4 of 97 SKUs. Revised
              artwork filed — your named clearance agent notified.
            </p>
          </div>
        </div>
      </motion.article>

      {/* ---- warehouse ---- */}
      <motion.article {...rise(5)} className={cx(cell, "md:col-span-3")}>
        <div className="relative h-full min-h-56">
          <Image
            src={IMAGES.distributionFloor.src}
            alt={IMAGES.distributionFloor.alt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="photo object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/80 to-canvas/25" />
          <div className="relative z-[1] flex h-full flex-col justify-end p-6 md:p-8">
            <IconTile icon={Boxes} tone="indigo" />
            <h3 className="mt-5 font-display text-card-title text-ink">
              Bonded warehousing, batch-level
            </h3>
            <Body>
              Hold duty-unpaid stock at Nhava Sheva, Mundra or Ahmedabad until
              you need it. Every carton mapped to a batch and expiry, so a
              recall is a query rather than an afternoon on the floor.
            </Body>
          </div>
        </div>
      </motion.article>
    </div>
  );
}
