"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Plane, Ship, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IMAGES } from "@/lib/images";
import { EASE, VIEWPORT } from "./motion/primitives";
import { cx } from "./ui";

type Mode = {
  name: string;
  transit: string;
  body: string;
  icon: LucideIcon;
  image: { src: string; alt: string };
  stats: [string, string][];
  tone: string;
  chip: string;
};

const MODES: Mode[] = [
  {
    name: "Air freight",
    transit: "5–9 days",
    body: "Six US gateways into Mumbai, Ahmedabad and Bengaluru. What you use when a line is short-dated or a launch date has already been promised.",
    icon: Plane,
    image: IMAGES.aircraftWing,
    stats: [
      ["Gateways", "6"],
      ["Departures", "Daily"],
      ["Min. chargeable", "45 kg"],
    ],
    tone: "text-semantic-info",
    chip: "border-semantic-info/35 bg-semantic-info/12 text-semantic-info",
  },
  {
    name: "Ocean freight",
    transit: "34–46 days",
    body: "FCL and weekly LCL consolidations out of New York, Houston, Savannah and Los Angeles into Nhava Sheva, Mundra and Chennai.",
    icon: Ship,
    image: IMAGES.containerShip,
    stats: [
      ["Ports", "4"],
      ["Sailings", "Weekly"],
      ["Min. LCL", "2 CBM"],
    ],
    tone: "text-primary-hover",
    chip: "border-primary/35 bg-primary/12 text-primary-hover",
  },
  {
    name: "Road & last mile",
    transit: "1–3 days",
    body: "Bonded movement from the port to our labelling floor, then delivery to your warehouse against a signed POD and stickering photos.",
    icon: Truck,
    image: IMAGES.parcelVan,
    stats: [
      ["Bonded sites", "3"],
      ["POD", "Signed"],
      ["Batch photos", "Every SKU"],
    ],
    tone: "text-semantic-success",
    chip: "border-semantic-success/35 bg-semantic-success/12 text-semantic-success",
  },
];

export default function TransportModes() {
  const reduce = useReducedMotion();

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {MODES.map((m, i) => {
        const Icon = m.icon;
        return (
          <motion.article
            key={m.name}
            className="gradient-border edge-lift spotlight group relative flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-md transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-xl"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.65, delay: i * 0.08, ease: EASE }}
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <Image
                src={m.image.src}
                alt={m.image.alt}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="photo object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-[1.05]"
              />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-surface-1 to-transparent" />
              <span
                className={cx(
                  "absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption backdrop-blur-md",
                  m.chip,
                )}
              >
                <Icon className="size-3.5" strokeWidth={2} />
                {m.name}
              </span>
              <span className="absolute top-4 right-4 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 font-mono text-[11px] text-white backdrop-blur-md">
                {m.transit}
              </span>
            </div>

            <div className="relative flex flex-1 flex-col p-6">
              <p className="text-body-sm text-ink-subtle">{m.body}</p>

              <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-hairline pt-5">
                {m.stats.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] text-ink-tertiary">{k}</dt>
                    <dd className={cx("mt-1 font-mono text-[13px]", m.tone)}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
