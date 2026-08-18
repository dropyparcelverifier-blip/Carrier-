"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Plane, Ship, ShieldCheck, ScanBarcode, PackageCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EASE } from "./motion/primitives";
import { cx } from "./ui";

/**
 * Illustrative activity feed — city/category level only, never a named
 * consignee. The demo shipment records in lib/demo-data.ts carry realistic
 * names and addresses for the tracker UI they were built for; reusing that
 * detail here, on a public decorative widget nobody asked to see, would
 * repurpose identity-shaped data outside the context it exists for. This
 * generates its own generic, non-identifying events instead.
 */
type Event = {
  id: number;
  icon: LucideIcon;
  tone: string;
  text: string;
  city: string;
};

const CATEGORIES = [
  "skincare",
  "cosmetics",
  "supplements",
  "fragrance",
  "electronics",
  "apparel",
];
const CITIES = ["Mumbai", "Pune", "Bengaluru", "Ahmedabad", "Navi Mumbai", "Thane"];

const TEMPLATES: { icon: LucideIcon; tone: string; text: (c: string) => string }[] = [
  { icon: Plane, tone: "text-vivid-blue", text: (c) => `${c} shipment departed origin` },
  { icon: ShieldCheck, tone: "text-vivid-violet", text: (c) => `Registration verified for a ${c} order` },
  { icon: Ship, tone: "text-vivid-cyan", text: (c) => `${c} consolidation cleared customs` },
  { icon: ScanBarcode, tone: "text-vivid-green", text: (c) => `MRP labelling completed on a ${c} batch` },
  { icon: PackageCheck, tone: "text-vivid-amber", text: (c) => `${c} order delivered` },
];

function randomEvent(id: number): Event {
  const t = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const cat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  return { id, icon: t.icon, tone: t.tone, text: t.text(cat), city };
}

export default function LiveFeed() {
  const reduce = useReducedMotion();
  // Seeded deterministically so server and client markup match on first
  // paint; the rotating feed only starts generating fresh (Math.random)
  // events after mount, entirely client-side.
  const [events, setEvents] = useState<Event[]>(() => [
    { id: 0, icon: Plane, tone: "text-vivid-blue", text: "Skincare shipment departed origin", city: "Newark" },
    { id: 1, icon: ShieldCheck, tone: "text-vivid-violet", text: "Registration verified for a cosmetics order", city: "Mumbai" },
    { id: 2, icon: ScanBarcode, tone: "text-vivid-green", text: "MRP labelling completed on a supplements batch", city: "Navi Mumbai" },
  ]);

  useEffect(() => {
    if (reduce) return;
    let id = events.length;
    const interval = setInterval(() => {
      setEvents((prev) => [randomEvent(id++), ...prev.slice(0, 2)]);
    }, 3200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  return (
    <div className="gradient-border edge-lift relative overflow-hidden rounded-lg bg-surface-1 shadow-sm">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
        <span className="relative flex size-1.5">
          <span className="pulse-ring absolute inline-flex size-full rounded-full bg-semantic-success" />
          <span className="relative inline-flex size-1.5 rounded-full bg-semantic-success" />
        </span>
        <span className="text-caption text-ink-muted">Live activity</span>
        <span className="ml-auto font-mono text-[11px] text-ink-tertiary">
          across the network
        </span>
      </div>

      <ul className="flex flex-col">
        <AnimatePresence initial={false} mode="popLayout">
          {events.map((e) => {
            const Icon = e.icon;
            return (
              <motion.li
                key={e.id}
                layout
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex items-center gap-3 border-b border-hairline-tertiary px-4 py-3 last:border-0"
              >
                <Icon className={cx("size-4 shrink-0", e.tone)} strokeWidth={1.8} />
                <span className="min-w-0 flex-1 truncate text-body-sm text-ink-muted">
                  {e.text}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-ink-tertiary">
                  {e.city}
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
