"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Plane, Ship } from "lucide-react";
import { EASE } from "./motion/primitives";
import { cx } from "./ui";

type Lane = {
  origin: string;
  code: string;
  destination: string;
  destCode: string;
  mode: "Air" | "Ocean";
  transit: string;
  frequency: string;
  cutoff: string;
};

const LANES: Lane[] = [
  { origin: "Newark", code: "EWR", destination: "Mumbai", destCode: "BOM", mode: "Air", transit: "5–7 days", frequency: "Daily", cutoff: "Tue 14:00 ET" },
  { origin: "Chicago", code: "ORD", destination: "Mumbai", destCode: "BOM", mode: "Air", transit: "6–8 days", frequency: "5× weekly", cutoff: "Mon 12:00 CT" },
  { origin: "New York", code: "JFK", destination: "Ahmedabad", destCode: "AMD", mode: "Air", transit: "6–8 days", frequency: "3× weekly", cutoff: "Wed 16:00 ET" },
  { origin: "Los Angeles", code: "LAX", destination: "Bengaluru", destCode: "BLR", mode: "Air", transit: "7–9 days", frequency: "2× weekly", cutoff: "Mon 11:00 PT" },
  { origin: "New York / NJ", code: "USNYC", destination: "Nhava Sheva", destCode: "INNSA", mode: "Ocean", transit: "38–44 days", frequency: "Weekly", cutoff: "Thu 17:00 ET" },
  { origin: "Houston", code: "USHOU", destination: "Mundra", destCode: "INMUN", mode: "Ocean", transit: "40–46 days", frequency: "Weekly", cutoff: "Wed 17:00 CT" },
  { origin: "Savannah", code: "USSAV", destination: "Nhava Sheva", destCode: "INNSA", mode: "Ocean", transit: "36–42 days", frequency: "Fortnightly", cutoff: "Fri 15:00 ET" },
  { origin: "Los Angeles", code: "USLAX", destination: "Chennai", destCode: "INMAA", mode: "Ocean", transit: "34–40 days", frequency: "Weekly", cutoff: "Tue 16:00 PT" },
];

const FILTERS = ["All", "Air", "Ocean"] as const;

export default function LaneTable() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const reduce = useReducedMotion();

  const rows = LANES.filter((l) => filter === "All" || l.mode === filter);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-lg text-body-sm text-ink-subtle">
          Transit is door-to-port, measured across the last twelve months. Cut-off
          is the latest we can collect from your supplier and still make that
          week&rsquo;s departure.
        </p>
        <div className="flex gap-1 rounded-full border border-hairline bg-surface-1 p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cx(
                "relative min-h-11 rounded-full px-3.5 text-body-sm transition-colors",
                filter === f ? "text-ink" : "text-ink-subtle hover:text-ink",
              )}
            >
              {filter === f ? (
                <motion.span
                  layoutId="lane-filter"
                  className="absolute inset-0 rounded-full bg-surface-3"
                  transition={{ duration: 0.28, ease: EASE }}
                />
              ) : null}
              <span className="relative">{f}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: stacked cards, not a shrunk-down table — a table forced
          into a horizontal scroller under a 6-column min-width is exactly
          the "looks broken on a phone" pattern the rest of this app avoids
          by using cards everywhere else. sm+ gets the real table below. */}
      <div className="grid gap-3 sm:hidden">
        {rows.map((l) => {
          const air = l.mode === "Air";
          const Icon = air ? Plane : Ship;
          return (
            <div
              key={`${l.code}-${l.destCode}-${l.mode}`}
              className="gradient-border rounded-lg border border-hairline bg-surface-1 p-4 shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-body-sm font-medium text-ink">
                    <span>{l.origin}</span>
                    <span className="font-mono text-[11px] text-ink-tertiary">{l.code}</span>
                    <ArrowRight className="mx-0.5 size-3 shrink-0 text-ink-tertiary" strokeWidth={2} />
                    <span>{l.destination}</span>
                    <span className="font-mono text-[11px] text-ink-tertiary">{l.destCode}</span>
                  </div>
                </div>
                <span
                  className={cx(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption",
                    air
                      ? "border-semantic-info/35 bg-semantic-info/12 text-semantic-info"
                      : "border-primary/35 bg-primary/12 text-primary-hover",
                  )}
                >
                  <Icon className="size-3" strokeWidth={2} />
                  {l.mode}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-hairline-tertiary pt-3 text-center">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-ink-tertiary">Transit</dt>
                  <dd className="mt-0.5 font-mono text-[12px] text-ink-muted">{l.transit}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-ink-tertiary">Departures</dt>
                  <dd className="mt-0.5 text-body-sm text-ink-subtle">{l.frequency}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-ink-tertiary">Cut-off</dt>
                  <dd className="mt-0.5 font-mono text-[12px] text-ink-subtle">{l.cutoff}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      {/* Desktop: the page column is capped at max-w-xl (see app/page.tsx)
          even on wide viewports, so this table has to fit ~36rem on its
          own — no min-width, no horizontal scroll. Origin/destination are
          merged into one wrapping "Route" cell (same pattern as the mobile
          card above) so the fixed-width columns (mode/transit/departures/
          cut-off) have room to breathe. */}
      <div className="gradient-border hidden overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-md sm:block">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[15%]" />
            <col className="w-[17%]" />
            <col className="w-[15%]" />
            <col className="w-[19%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-hairline">
              <th className="px-3 py-3 text-caption font-medium text-ink-tertiary">
                Route
              </th>
              <th className="px-2 py-3 text-caption font-medium text-ink-tertiary">
                Mode
              </th>
              <th className="px-2 py-3 text-right text-caption font-medium text-ink-tertiary">
                Transit
              </th>
              <th className="px-2 py-3 text-right text-caption font-medium text-ink-tertiary">
                Departs
              </th>
              <th className="px-3 py-3 text-right text-caption font-medium text-ink-tertiary">
                Cut-off
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l, i) => {
              const air = l.mode === "Air";
              const Icon = air ? Plane : Ship;
              return (
                <motion.tr
                  key={`${l.code}-${l.destCode}-${l.mode}`}
                  className="border-b border-hairline-tertiary transition-colors last:border-0 hover:bg-surface-2"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.03, ease: EASE }}
                >
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-body-sm text-ink">
                      <span>{l.origin}</span>
                      <span className="font-mono text-[10px] text-ink-tertiary">{l.code}</span>
                      <ArrowRight className="mx-0.5 size-3 shrink-0 text-ink-tertiary" strokeWidth={2} />
                      <span>{l.destination}</span>
                      <span className="font-mono text-[10px] text-ink-tertiary">{l.destCode}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={cx(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-caption",
                        air
                          ? "border-semantic-info/35 bg-semantic-info/12 text-semantic-info"
                          : "border-primary/35 bg-primary/12 text-primary-hover",
                      )}
                    >
                      <Icon className="size-3 shrink-0" strokeWidth={2} />
                      {l.mode}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-[11px] text-ink-muted">
                    {l.transit}
                  </td>
                  <td className="px-2 py-3 text-right text-body-sm text-ink-subtle">
                    {l.frequency}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[11px] text-ink-subtle">
                    {l.cutoff}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-caption text-ink-tertiary">
        Not on this list? We consolidate out of most US states — ask and
        we&rsquo;ll quote it.
      </p>
    </div>
  );
}
