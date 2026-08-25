"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { EASE, Reveal, VIEWPORT } from "./motion/primitives";
import { cx, ICON_TONE, SectionHeading, type IconTone } from "./ui";

const LIMITS: { title: string; body: string; tone: IconTone }[] = [
  {
    title: "We don't do sea freight under 2 CBM",
    body: "LCL that small costs you more in origin charges than the freight is worth. Send it air, or hold it until the next container.",
    tone: "coral",
  },
  {
    title: "We won't ship without your registration in hand",
    body: "If the CDSCO certificate doesn't cover a SKU on your list, we stop the booking at origin. A container sitting at Nhava Sheva costs far more than a week's delay.",
    tone: "amber",
  },
  {
    title: "We don't quote a landed cost we can't stand behind",
    body: "If the HS classification is genuinely arguable, we'll say so and give you a range, not a number that looks precise and turns out wrong.",
    tone: "indigo",
  },
  {
    title: "We're not the cheapest",
    body: "Clearance, labelling and a named agent cost money. If you only need port-to-port and you'll handle customs yourself, a straight forwarder will beat us on price.",
    tone: "blue",
  },
];

export default function Limits() {
  const reduce = useReducedMotion();

  return (
    <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[0.8fr_1.2fr]">
      <Reveal>
        <SectionHeading
          eyebrow="Limits"
          eyebrowIcon={ShieldAlert}
          title="Things we'll turn down"
          body="Most forwarders won't tell you this until the invoice. Better you know before you book."
          className="max-w-sm"
        />
        <Link
          href="/prohibited-items"
          className="group mt-5 inline-flex items-center gap-1.5 text-body-sm font-medium text-primary hover:underline"
        >
          Full prohibited &amp; restricted items list
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2} />
        </Link>
      </Reveal>

      <ul className="grid gap-4 sm:grid-cols-2">
        {LIMITS.map((l, i) => (
          <motion.li
            key={l.title}
            className="gradient-border edge-lift relative flex flex-col gap-4 overflow-hidden rounded-lg border border-hairline bg-surface-1 p-5 shadow-sm transition-all duration-400 ease-out hover:-translate-y-1 hover:shadow-lg"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.55, delay: i * 0.06, ease: EASE }}
          >
            <span
              aria-hidden
              className={cx(
                "absolute inset-x-0 top-0 h-[3px]",
                l.tone === "coral" && "bg-vivid-coral",
                l.tone === "amber" && "bg-vivid-amber",
                l.tone === "indigo" && "bg-vivid-indigo",
                l.tone === "blue" && "bg-vivid-blue",
              )}
            />
            <span
              className={cx(
                "relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-md border font-mono text-body-sm font-semibold tabular-nums",
                ICON_TONE[l.tone],
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="relative z-[1]">
              <h3 className="text-body font-medium text-ink">{l.title}</h3>
              <p className="mt-1.5 text-body-sm text-ink-subtle">{l.body}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
