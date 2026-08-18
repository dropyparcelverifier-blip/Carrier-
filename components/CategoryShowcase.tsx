"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Boxes,
  Droplets,
  Palette,
  Pill,
  SprayCan,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IMAGES } from "@/lib/images";
import { EASE, VIEWPORT } from "./motion/primitives";

type Category = {
  title: string;
  body: string;
  hs: string | null;
  regime: string | null;
  icon: LucideIcon;
  image: { src: string; alt: string };
  /* Full literal class strings — Tailwind cannot see interpolated names. */
  accentText: string;
  accentBg: string;
  accentBorder: string;
  accentBar: string;
  accentGlow: string;
};

const CATEGORIES: Category[] = [
  {
    title: "Colour cosmetics",
    body: "Palettes, compacts, lip and nail. High SKU counts, small batches, and shade codes that have to survive the packing list intact.",
    hs: "HS 3304",
    regime: "CDSCO",
    icon: Palette,
    image: IMAGES.colourCosmetics,
    accentText: "text-cat-cosmetics",
    accentBg: "bg-cat-cosmetics/15",
    accentBorder: "border-cat-cosmetics/35",
    accentBar: "bg-cat-cosmetics",
    accentGlow:
      "group-hover:shadow-[0_24px_60px_-20px_color-mix(in_srgb,var(--color-cat-cosmetics)_45%,transparent)]",
  },
  {
    title: "Skincare & haircare",
    body: "Serums, lotions, treatments and professional salon lines — the volume backbone of most of our containers.",
    hs: "HS 3304 / 3305",
    regime: "CDSCO",
    icon: Droplets,
    image: IMAGES.serumDropper,
    accentText: "text-cat-skincare",
    accentBg: "bg-cat-skincare/15",
    accentBorder: "border-cat-skincare/35",
    accentBar: "bg-cat-skincare",
    accentGlow:
      "group-hover:shadow-[0_24px_60px_-20px_color-mix(in_srgb,var(--color-cat-skincare)_45%,transparent)]",
  },
  {
    title: "Fragrance & luxury",
    body: "Alcohol-based and aerosol lines shipped as dangerous goods, with the packing certification and air space that requires.",
    hs: "HS 3303",
    regime: "CDSCO + DG",
    icon: SprayCan,
    image: IMAGES.beautyFlatlay,
    accentText: "text-cat-fragrance",
    accentBg: "bg-cat-fragrance/15",
    accentBorder: "border-cat-fragrance/35",
    accentBar: "bg-cat-fragrance",
    accentGlow:
      "group-hover:shadow-[0_24px_60px_-20px_color-mix(in_srgb,var(--color-cat-fragrance)_45%,transparent)]",
  },
  {
    title: "Supplements & wellness",
    body: "Vitamins, protein and nutraceuticals under FSSAI import clearance, with shelf-life and label claims checked before they leave the US.",
    hs: "HS 2106",
    regime: "FSSAI",
    icon: Pill,
    image: IMAGES.supplements,
    accentText: "text-cat-supplements",
    accentBg: "bg-cat-supplements/15",
    accentBorder: "border-cat-supplements/35",
    accentBar: "bg-cat-supplements",
    accentGlow:
      "group-hover:shadow-[0_24px_60px_-20px_color-mix(in_srgb,var(--color-cat-supplements)_45%,transparent)]",
  },
  {
    title: "General cargo",
    body: "Outside beauty and wellness, we still run the freight and the clearance — electronics, apparel, industrial goods. We scope the registration and paperwork per shipment rather than assume a template fits.",
    hs: null,
    regime: null,
    icon: Boxes,
    image: IMAGES.warehouseRacking,
    accentText: "text-cat-general",
    accentBg: "bg-cat-general/15",
    accentBorder: "border-cat-general/35",
    accentBar: "bg-cat-general",
    accentGlow:
      "group-hover:shadow-[0_24px_60px_-20px_color-mix(in_srgb,var(--color-cat-general)_45%,transparent)]",
  },
];

export default function CategoryShowcase() {
  const reduce = useReducedMotion();

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
      {CATEGORIES.map((cat, i) => {
        const Icon = cat.icon;
        return (
          <motion.article
            key={cat.title}
            className={`gradient-border edge-lift group relative flex flex-col overflow-hidden rounded-lg bg-surface-1 shadow-lg transition-all duration-500 ease-out hover:-translate-y-1.5 ${cat.accentGlow}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.65, delay: i * 0.08, ease: EASE }}
          >
            {/* colour key along the top edge */}
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 z-20 h-[3px] ${cat.accentBar}`}
            />

            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src={cat.image.src}
                alt={cat.image.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                className="photo object-cover transition-transform duration-[1.3s] ease-out group-hover:scale-[1.06]"
              />
              {/* only the bottom fifth fades, so the photo stays legible */}
              <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-surface-1 to-transparent" />

              {/*
                Both badges use the same dark glass chip. They sit on
                photography that ranges from near-white marble to a dark blue
                blister pack, so a tinted-light chip was legible on some cards
                and fragile on others. One fixed treatment reads consistently
                on any image; the category hue stays on the top bar and the
                icon tile, where it has a controlled background.
              */}
              {cat.hs ? (
                <span className="absolute top-4 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 font-mono text-[11px] text-white backdrop-blur-md">
                  <span
                    aria-hidden
                    className={`size-1.5 rounded-full ${cat.accentBar}`}
                  />
                  {cat.hs}
                </span>
              ) : null}
              {cat.regime ? (
                <span className="absolute top-4 right-3 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[11px] text-white backdrop-blur-md">
                  {cat.regime}
                </span>
              ) : null}
            </div>

            <div className="relative flex flex-1 flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`inline-flex size-11 items-center justify-center rounded-md border ${cat.accentBorder} ${cat.accentBg} ${cat.accentText} shadow-sm transition-transform duration-500 group-hover:-translate-y-0.5`}
                >
                  <Icon className="size-5" strokeWidth={1.9} />
                </span>
                {/* the same "this is tappable" affordance the client cards
                    use — appears on hover/focus rather than sitting there
                    permanently, so it reads as a reveal, not clutter */}
                <span
                  aria-hidden
                  className={`flex size-7 shrink-0 translate-x-1 items-center justify-center rounded-full border border-hairline bg-surface-2 text-ink-tertiary opacity-0 transition-all duration-400 group-hover:translate-x-0 group-hover:opacity-100 ${cat.accentText}`}
                >
                  <ArrowRight className="size-3.5" strokeWidth={1.9} />
                </span>
              </div>

              <h3 className="mt-4 font-display text-card-title text-ink">
                {cat.title}
              </h3>
              <p className="mt-2 text-body-sm text-ink-subtle">{cat.body}</p>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
