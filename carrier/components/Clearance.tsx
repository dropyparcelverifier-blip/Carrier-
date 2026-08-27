"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Check, FileSearch, MapPin, PackageSearch, Warehouse } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CLEARANCE, FACILITIES } from "@/lib/network";
import { IMAGES } from "@/lib/images";
import { EASE, VIEWPORT } from "./motion/primitives";
import { cx } from "./ui";

const ICONS: LucideIcon[] = [FileSearch, PackageSearch];

/**
 * Mumbai clearance. The two verifications are sequential and distinct —
 * documentary first, physical second — and cargo does not move to the bonded
 * floor until both clear. Presenting them as one "customs" step is what makes
 * importers think a hold is arbitrary.
 */
export default function Clearance() {
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {CLEARANCE.map((c, i) => {
          const Icon = ICONS[i] ?? FileSearch;
          return (
            <motion.article
              key={c.step}
              className="gradient-border edge-lift spotlight group relative flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface-1 p-6 shadow-md transition-all duration-500 hover:shadow-xl md:p-8"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.65, delay: i * 0.1, ease: EASE }}
            >
              <div className="relative z-[1] flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-md border border-semantic-warn/35 bg-semantic-warn/12 text-semantic-warn">
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <span className="font-mono text-mono text-semantic-warn">
                  Verification {c.step}
                </span>
              </div>

              <h3 className="relative z-[1] mt-5 font-display text-card-title text-ink">
                {c.title}
              </h3>
              <p className="relative z-[1] mt-1.5 font-mono text-[11px] text-ink-tertiary">
                {c.where}
              </p>
              <p className="relative z-[1] mt-4 text-body-sm text-ink-subtle">
                {c.body}
              </p>

              <ul className="relative z-[1] mt-6 flex flex-col gap-2.5 border-t border-hairline pt-5">
                {c.checks.map((check) => (
                  <li key={check} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-semantic-success/15">
                      <Check
                        className="size-2.5 text-semantic-success"
                        strokeWidth={3}
                      />
                    </span>
                    <span className="text-caption text-ink-muted">{check}</span>
                  </li>
                ))}
              </ul>
            </motion.article>
          );
        })}
      </div>

      {/* where the cargo physically sits */}
      <motion.div
        className="overflow-hidden rounded-lg border border-hairline bg-hairline"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
      >
        {/*
          A photo of the floor itself. The three facility cards below are dense
          text; without an anchor the whole strip reads as a footnote rather
          than as the physical place the cargo actually sits.
        */}
        <div className="relative h-40 overflow-hidden bg-surface-3 sm:h-52">
          <Image
            src={IMAGES.binPicking.src}
            alt={IMAGES.binPicking.alt}
            fill
            sizes="(min-width: 1024px) 1100px, 100vw"
            className="scale-105 object-cover object-center transition-transform duration-[1.2s] ease-out hover:scale-110"
          />
          {/* Decorative only. The caption sits on the solid bar below rather
              than on the photo — legibility over a gradient depends on what
              the image happens to be doing behind each glyph, and this one is
              a bright yellow floor. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-[#0b0d12]/45 to-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline bg-surface-1 px-5 py-4 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/12 px-2.5 py-1 text-caption text-primary-hover">
            <MapPin className="size-3.5" strokeWidth={2} />
            Destination network
          </span>
          <p className="font-display text-card-title text-ink">
            Where your stock waits, gets labelled and gets released
          </p>
        </div>

        <div className="grid gap-px border-t border-hairline bg-hairline md:grid-cols-3">
        {FACILITIES.map((f) => (
          <div key={f.name} className="bg-surface-1 p-6">
            <div className="flex items-center gap-2.5">
              <Warehouse className="size-4 text-primary-hover" strokeWidth={1.8} />
              <span className="text-body-sm font-medium text-ink">{f.name}</span>
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-ink-tertiary">
              {f.location}
            </p>
            <p
              className={cx(
                "mt-3 inline-flex rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-caption text-ink-subtle",
              )}
            >
              {f.role}
            </p>
            <p className="mt-3 text-caption text-ink-subtle">{f.detail}</p>
          </div>
        ))}
        </div>
      </motion.div>
    </div>
  );
}
