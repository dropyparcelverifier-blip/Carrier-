"use client";

import { motion, useReducedMotion } from "motion/react";
import { Quote, Star } from "lucide-react";
import { EASE, VIEWPORT } from "./motion/primitives";
import type { IconTone } from "./ui";


export const TESTIMONIALS: {
  quote: string;
  name: string;
  role: string;
  initial: string;
  avatar: string;
  tone: IconTone;
}[] = [
  {
    quote:
      "The tracking number lands the same day we send the SKU list. That alone cut our WhatsApp-to-broker traffic to almost nothing.",
    name: "Operations Lead",
    role: "Beauty & personal care distributor, Mumbai",
    initial: "OL",
    avatar: "https://i.pinimg.com/originals/5c/0d/ad/5c0dad72169d2ef8a49ce555ab5e4b2f.jpg",
    tone: "violet",
  },
  {
    quote:
      "We had a shelf-life issue flagged at the US dock before the container even sailed. That's the kind of catch that used to cost us a write-off.",
    name: "Supply Chain Manager",
    role: "Wellness & supplements retailer, Pune",
    initial: "SC",
    avatar: "https://img.freepik.com/premium-photo/confident-indian-businessmen-posing-corporate-headshot_861171-12556.jpg?w=360npm r",
    tone: "green",
  },
  {
    quote:
      "Customs queries used to mean a week of silence. Now it's an exception on the record with our agent's name on it, same day.",
    name: "Import Coordinator",
    role: "Marketplace fulfilment partner, Bengaluru",
    initial: "IC",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    tone: "amber",
  },
  {
    quote:
      "MRP stickering used to be a separate vendor and another week. Now it happens on the same floor as clearance, photo-verified per batch, before it ever reaches our warehouse.",
    name: "Category Manager",
    role: "Marketplace seller, colour cosmetics, Delhi NCR",
    initial: "CM",
    avatar: "https://images.pexels.com/photos/30426363/pexels-photo-30426363.jpeg",
    tone: "pink",
  },
  {
    quote:
      "Ocean freight quotes used to be a guess dressed up as a number. When the HS classification was genuinely arguable, they told us upfront instead of finding out at assessment.",
    name: "Procurement Head",
    role: "Distributor, fragrance & personal care, Chennai",
    initial: "PH",
    avatar: "https://img.freepik.com/premium-photo/confident-ambitious-young-indian-woman-corporate-office_753390-7294.jpg",
    tone: "blue",
  },
  {
    quote:
      "Five source markets, one tracking link. Our finance team stopped asking which forwarder a shipment was even with.",
    name: "Founder",
    role: "D2C skincare brand, Bengaluru",
    initial: "FD",
    // The original pixabay.com/images/download/... link 403s when hotlinked
    // (that path requires a browser session, not a stable CDN URL) — a
    // generated illustration standing in for a broken photo, not a
    // deliberate style choice for this one card.
    avatar: "https://img.freepik.com/premium-photo/professional-headshot-indian-woman-business_943281-26258.jpg?w=740",
    tone: "cyan",
  },
];

export const AVATAR_GRADIENT: Record<IconTone, string> = {
  primary: "linear-gradient(135deg, var(--color-primary), var(--color-primary-deep))",
  violet: "linear-gradient(135deg, var(--color-vivid-violet), var(--color-vivid-indigo))",
  blue: "linear-gradient(135deg, var(--color-vivid-blue), var(--color-primary-deep))",
  cyan: "linear-gradient(135deg, var(--color-vivid-cyan), var(--color-vivid-blue))",
  green: "linear-gradient(135deg, var(--color-vivid-green), var(--color-vivid-cyan))",
  amber: "linear-gradient(135deg, var(--color-vivid-amber), var(--color-vivid-coral))",
  coral: "linear-gradient(135deg, var(--color-vivid-coral), var(--color-vivid-pink))",
  pink: "linear-gradient(135deg, var(--color-vivid-pink), var(--color-vivid-violet))",
  indigo: "linear-gradient(135deg, var(--color-vivid-indigo), var(--color-vivid-blue))",
};

export default function Testimonials() {
  const reduce = useReducedMotion();

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {TESTIMONIALS.map((t, i) => (
        <motion.figure
          key={t.name + i}
          className="gradient-border edge-lift spotlight group relative flex flex-col overflow-hidden rounded-lg bg-surface-1 p-6 shadow-md transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-xl md:p-7"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.65, delay: i * 0.1, ease: EASE }}
        >
          <Quote
            aria-hidden
            className="absolute top-5 right-5 size-8 opacity-[0.08] transition-opacity duration-500 group-hover:opacity-[0.14]"
            style={{ color: `var(--color-vivid-${t.tone})` }}
            strokeWidth={1.6}
          />

          <div className="relative z-[1] flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, si) => (
              <Star
                key={si}
                className="size-3.5 fill-vivid-amber text-vivid-amber"
                strokeWidth={1.8}
              />
            ))}
          </div>

          <blockquote className="relative z-[1] mt-4 flex-1 text-body-sm text-ink-subtle">
            &ldquo;{t.quote}&rdquo;
          </blockquote>

          <figcaption className="relative z-[1] mt-6 flex items-center gap-3 border-t border-hairline pt-5">
            {/* Gradient halo ring: a 2px padding of AVATAR_GRADIENT behind
                the photo, not a flat ring color, so each card reads with
                its own tone at a glance. Photo itself needs object-cover —
                without it, a non-square source photo stretches to fill the
                circle instead of cropping to it. */}
            <span
              className="flex size-12 shrink-0 rounded-full p-[2px] shadow-sm"
              style={{ backgroundImage: AVATAR_GRADIENT[t.tone] }}
            >
              <span className="size-full overflow-hidden rounded-full ring-2 ring-surface-1">
                <img
                  src={t.avatar}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </span>
            </span>
            <span>
              <span className="block text-body-sm font-medium text-ink">
                {t.name}
              </span>
              <span className="block text-caption text-ink-tertiary">
                {t.role}
              </span>
            </span>
          </figcaption>
        </motion.figure>
      ))}
    </div>
  );
}
