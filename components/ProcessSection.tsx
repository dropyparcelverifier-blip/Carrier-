"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { ClipboardList, PackageCheck, Plane, Ship, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IMAGES } from "@/lib/images";
import { EASE, VIEWPORT } from "./motion/primitives";
import { cx } from "./ui";

type Step = {
  step: string;
  title: string;
  body: string;
  icon: LucideIcon;
  image: { src: string; alt: string };
  meta: string[];
  /* Full literal class strings — Tailwind cannot see interpolated names. */
  accentText: string;
  accentBg: string;
  accentBorder: string;
};

const STEPS: Step[] = [
  {
    step: "01",
    title: "Send the order",
    body: "Share the supplier, the SKU list and the Incoterm. We check your CDSCO or FSSAI cover against those SKUs, flag anything short-dated, and issue a tracking number the same day.",
    icon: ClipboardList,
    image: IMAGES.serumDropper,
    meta: ["Registration check", "Shelf-life screen", "Tracking number issued"],
    accentText: "text-primary-hover",
    accentBg: "bg-primary/15",
    accentBorder: "border-primary/35",
  },
  {
    step: "02",
    title: "We move it out of origin",
    body: "Pickup from the supplier's dock, consolidation at the origin gateway, export filing, and dangerous-goods certification where fragrance or aerosol lines are involved — then the fastest confirmed space.",
    icon: Plane,
    image: IMAGES.aircraftWing,
    meta: ["US, UK & Korea pickup", "Export filing", "Air & ocean space"],
    accentText: "text-semantic-info",
    accentBg: "bg-semantic-info/15",
    accentBorder: "border-semantic-info/35",
  },
  {
    step: "03",
    title: "We clear it",
    body: "Bill of entry filed before arrival, then two verifications at Mumbai — documentary, then physical. Duty paid on your behalf where you hold a credit line, with the landed cost reconciled against our estimate.",
    icon: Ship,
    image: IMAGES.containerPort,
    meta: ["Pre-arrival BOE", "Two verifications", "Cost reconciliation"],
    accentText: "text-semantic-warn",
    accentBg: "bg-semantic-warn/15",
    accentBorder: "border-semantic-warn/35",
  },
  {
    step: "04",
    title: "We label and deliver",
    body: "MRP stickering at our Vashi bonded facility — importer details, net quantity, country of origin, best-before — photo-verified per batch, then delivery to your warehouse against a signed POD.",
    icon: Truck,
    image: IMAGES.truck,
    meta: ["Legal Metrology labels", "Photo verification", "Signed POD"],
    accentText: "text-semantic-success",
    accentBg: "bg-semantic-success/15",
    accentBorder: "border-semantic-success/35",
  },
];

export default function ProcessSection() {
  const reduce = useReducedMotion();
  const railRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ["start 80%", "end 55%"],
  });
  const drawn = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 24,
    restDelta: 0.001,
  });

  return (
    <div ref={railRef} className="relative">
      {/* the spine — a static hairline underneath, and a coloured length that
          draws itself as you scroll past each checkpoint, so the four moves
          read as a route being walked rather than four independent cards. */}
      <div
        aria-hidden
        className="absolute top-0 bottom-0 left-[27px] hidden w-px bg-hairline lg:block"
      />
      <motion.div
        aria-hidden
        className="absolute top-0 left-[27px] hidden w-px origin-top bg-gradient-to-b from-primary via-primary-hover to-accent lg:block"
        style={{ scaleY: reduce ? 1 : drawn, bottom: 0 }}
      />

      <div className="flex flex-col gap-6">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.article
              key={s.step}
              className="relative lg:pl-20"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.7, delay: i * 0.05, ease: EASE }}
            >
              {/* spine node — a checkpoint being reached, not just decoration:
                  it lands a beat after the card with a small overshoot, and
                  carries the same pulse ring the tracker uses for a live
                  scan, so the route reads as active rather than a static
                  diagram. */}
              <motion.span
                className={cx(
                  "absolute top-8 left-0 hidden size-14 items-center justify-center rounded-full border shadow-lg lg:flex",
                  s.accentBorder,
                  s.accentBg,
                  s.accentText,
                )}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={VIEWPORT}
                transition={{
                  duration: 0.5,
                  delay: i * 0.05 + 0.2,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
              >
                {!reduce ? (
                  <span
                    className={cx(
                      "pulse-ring absolute inset-0 rounded-full",
                      s.accentBg,
                    )}
                    style={{ animationDelay: `${i * 0.6}s` }}
                  />
                ) : null}
                <Icon className="relative size-5" strokeWidth={1.8} />
              </motion.span>

              <div className="gradient-border edge-lift spotlight group grid overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-md transition-all duration-500 hover:shadow-xl md:grid-cols-[1.35fr_1fr]">
                <div className="relative z-[1] p-6 md:p-8">
                  <div className="flex items-center gap-3">
                    <span
                      className={cx("font-mono text-mono", s.accentText)}
                    >
                      {s.step}
                    </span>
                    <span className="h-px flex-1 bg-hairline" />
                  </div>

                  <h3 className="mt-4 font-display text-headline text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-body-sm text-ink-subtle">
                    {s.body}
                  </p>

                  <ul className="mt-6 flex flex-wrap gap-2">
                    {s.meta.map((m, mi) => (
                      <motion.li
                        key={m}
                        className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-caption text-ink-subtle transition-colors duration-300 hover:border-hairline-strong hover:text-ink-muted"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={VIEWPORT}
                        transition={{
                          duration: 0.4,
                          delay: i * 0.05 + 0.3 + mi * 0.08,
                          ease: EASE,
                        }}
                      >
                        <PackageCheck
                          className="size-3 text-semantic-success"
                          strokeWidth={2}
                        />
                        {m}
                      </motion.li>
                    ))}
                  </ul>
                </div>

                <div
                  className={cx(
                    "relative min-h-56 overflow-hidden md:min-h-full",
                    i % 2 ? "md:order-first" : "",
                  )}
                >
                  <Image
                    src={s.image.src}
                    alt={s.image.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    className="photo object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-105"
                  />
                  {/* feather only the inner edge into the card */}
                  <div
                    className={cx(
                      "absolute inset-0",
                      i % 2
                        ? "bg-gradient-to-r from-transparent via-transparent to-surface-1"
                        : "bg-gradient-to-l from-transparent via-transparent to-surface-1",
                    )}
                  />
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
