"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  ClipboardCheck,
  Container,
  History,
  IndianRupee,
  Landmark,
  MapPin,
  Mail,
  Navigation,
  Package,
  PackageCheck,
  PackageSearch,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Scale,
  Ship,
  Truck,
  User,
  Warehouse,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { nextStage, nextStageLabel, STAGE_PHASE, STAGES, usdToInrFormatted, type Shipment, type StageKey, type TrackingEvent } from "@/lib/types";
import { isLive, modeStyle, statusStyle } from "@/lib/status";
import { relativeDays } from "@/lib/dates";
import { orderGreeting } from "@/lib/greeting";
import { EASE } from "./motion/primitives";
import { cx } from "./ui";
import { COMPANY } from "@/lib/company";
import { copyText } from "@/lib/copy-text";

/* ── Copy hook ── */
function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void copyText(text).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return { copied, copy };
}

/**
 * Both Shiprocket and Velocity's tracking URLs (built in
 * lib/last-mile.ts courierTrackingUrl) are confirmed real deep links —
 * opening either shows the actual tracking result directly, no AWB
 * re-entry needed. (An earlier version of this file assumed neither
 * worked based on one bad manual test of each; both were re-verified by
 * hand — see lib/last-mile.ts's own header note.) So this is just a
 * single link, no copy-then-paste flow required.
 */
function LastMileTrackingLink({ courier, url }: { courier: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-surface-1 px-3.5 py-1.5 text-caption font-medium text-ink transition-colors hover:border-primary/40 hover:text-primary-hover"
    >
      Track this order on {courier}
      <ArrowRight className="size-3" strokeWidth={2} />
    </a>
  );
}

/* ── Status → CSS var name (avoids template literal purge issues) ── */
function statusVar(status: Shipment["status"]): string {
  switch (status) {
    case "Customs Clearance": return "var(--color-semantic-warn)";
    case "At Warehouse":      return "var(--color-semantic-info)";
    case "Received":          return "var(--color-semantic-success)";
    case "In Transit":
    case "Processing":        return "var(--color-primary)";
    default:                  return "var(--color-ink-subtle)";
  }
}

/* ── Stage → icon ──
 * Only the CURRENT and NEXT rows use this — every "done" row still
 * collapses to a uniform green check (that's the right amount of detail
 * for something already behind you), but the one row that matters most
 * right now, and the one row previewing what's coming, get an icon that
 * actually says what kind of event this is, not a generic dot. */
const STAGE_ICON: Record<StageKey, LucideIcon> = {
  order_placed:        Package,
  processing:           PackageSearch,
  packed:                PackageCheck,
  dispatched:             Truck,
  at_us_airport:           PlaneTakeoff,
  us_customs_cleared:       Landmark,
  in_transit_departed:       Navigation,
  mid_transit:                 Navigation,
  arrived_india:                 PlaneLanding,
  indian_customs:                 Landmark,
  customs_cleared:                  ClipboardCheck,
  at_vashi_warehouse:                Warehouse,
  qc_check:                           ClipboardCheck,
  handed_to_courier:                    Truck,
};


export function StatusPill({ status, courier }: { status: Shipment["status"]; courier?: string }) {
  const tone = statusStyle(status);
  const live = isLive(status);
  // "Forwarded to Courier" is a fixed underlying status (drives pill
  // color/isLive across the whole app — see lib/status.ts), but the real
  // courier (Shiprocket/Velocity) is order-specific, so it's appended to
  // the displayed text here rather than being its own status value.
  const label = status === "Forwarded to Courier" && courier ? `${status} — ${courier}` : status;
  return (
      <span className={cx(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-medium sm:gap-2 sm:px-3",
          tone.pill,
      )}>
      <span className="relative flex size-1.5">
        {live ? <span className={cx("pulse-ring absolute inline-flex size-full rounded-full", tone.dot)} /> : null}
        <span className={cx("relative inline-flex size-1.5 rounded-full", tone.dot)} />
      </span>
        {label}
    </span>
  );
}

function EventRow({ event, last, index }: { event: TrackingEvent; last: boolean; index: number }) {
  const reduce = useReducedMotion();
  const done      = event.state === "done";
  const current   = event.state === "current";
  const exception = event.state === "exception";
  const pending   = event.state === "pending";
  const StageIcon = STAGE_ICON[event.stage];

  return (
      <motion.li
          className={cx(
              "relative flex gap-3 rounded-xl pb-5 transition-colors last:pb-0 sm:gap-4 sm:pb-6",
              // The current stage gets a real background band plus a left
              // accent bar, not just a colored dot — otherwise it reads at
              // the same visual weight as every done/pending row and the
              // "you are here" signal is easy to miss on a 12-event list.
              // No negative margin here (an earlier version used -my-1 to
              // "expand" the row) — every sibling row's connector line is
              // positioned with plain top/bottom offsets that assume
              // normal box flow, so a margin shift on this row alone broke
              // the line feeding into it from above. Padding-only growth
              // keeps every row's line math correct regardless of which
              // row is current.
              current
                  ? "bg-primary/[0.07] py-3.5 shadow-[inset_2px_0_0_var(--color-primary)] sm:py-4"
                  : "hover:bg-surface-2/40",
          )}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: index * 0.05, ease: EASE }}
      >
        {!last ? (
            <span
                aria-hidden
                className={cx(
                    "absolute top-5 bottom-0 left-[9px] w-px",
                    done ? "bg-semantic-success/40" : "bg-hairline",
                )}
            />
        ) : null}

        <span className="relative z-10 mt-1 flex size-5 shrink-0 items-center justify-center">
          {done ? (
              <CheckCircle2 className="size-5 text-semantic-success" strokeWidth={2} />
          ) : exception ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-semantic-alert/15 text-semantic-alert">
            <span className="size-2 rounded-full bg-semantic-alert" />
          </span>
          ) : current ? (
              // The "you are here" row gets the stage's own icon, not a
              // plain dot — this is the one row on the page where "what
              // kind of thing is happening right now" is worth a real
              // glyph instead of a colour alone.
              <span className="relative flex size-5 items-center justify-center">
            <span className="pulse-ring absolute size-full rounded-full bg-primary/30" />
            <span className="relative flex size-5 items-center justify-center rounded-full bg-primary text-white shadow-glow">
              <StageIcon className="size-3" strokeWidth={2.2} />
            </span>
          </span>
          ) : (
              <span className="neuro-pressed-sm size-2.5 rounded-full" />
          )}
      </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4">
            <p className={cx(
                "text-body-sm",
                pending   ? "text-ink-tertiary" : "text-ink",
                current   && "font-semibold",
                exception && "font-semibold text-semantic-alert",
            )}>
              {event.label}
              {current ? (
                  <span className="ml-2 rounded-full bg-primary/15 px-1.5 py-0.5 align-middle text-[9px] font-semibold tracking-wide text-primary uppercase">
                    Now
                  </span>
              ) : null}
            </p>
            <p className="font-mono text-[10px] text-ink-tertiary sm:text-[11px]">
              {event.timestamp}
            </p>
          </div>
          <p className="mt-0.5 flex items-start gap-1.5 text-caption text-ink-tertiary">
            <MapPin className="mt-0.5 size-3 shrink-0" strokeWidth={1.8} />
            <span>{event.location}</span>
          </p>
          {event.carrier ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-caption text-ink-tertiary">
              <Truck className="size-3 shrink-0" strokeWidth={1.8} />
              {event.courierLink ? (
                <a href={event.courierLink} target="_blank" rel="noopener noreferrer"
                  className="truncate text-primary hover:text-primary-hover hover:underline">
                  Moved by {event.carrier} — track here
                </a>
              ) : (
                <span className="truncate">Moved by {event.carrier}</span>
              )}
            </p>
          ) : null}
          {event.note ? (
              <p className={cx(
                  "neuro-surface neuro-pressed-sm mt-2 rounded-lg px-3 py-2.5 text-caption sm:mt-2.5 sm:px-3.5",
                  exception ? "text-ink-muted" : "text-ink-subtle",
              )}>
                {event.note}
              </p>
          ) : null}
        </div>
      </motion.li>
  );
}

/** A dimmed, dashed-outline preview row for the stage after the current
 *  one — the timeline otherwise only ever shows what's already happened,
 *  so "what's next" was answerable nowhere on the page. Hollow/dashed,
 *  not the solid done-check or pulsing current-dot, so it reads as a
 *  third, distinct "not yet, but coming" state rather than an early done
 *  item — but still carries the stage's own icon, faint, so "what's
 *  coming" is legible at a glance and not just a ghost dot. */
function NextStageRow({ stage, label }: { stage: StageKey; label: string }) {
  const StageIcon = STAGE_ICON[stage];
  return (
      <li className="relative flex gap-3 pb-5 opacity-50 sm:gap-4 sm:pb-6">
        <span
            aria-hidden
            className="absolute top-5 bottom-0 left-[9px] w-px bg-hairline"
        />
        <span className="relative z-10 mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-ink-tertiary text-ink-tertiary">
          <StageIcon className="size-2.5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-body-sm text-ink-tertiary">
            {label}
            <span className="ml-2 text-caption">— next</span>
          </p>
        </div>
      </li>
  );
}

function TimelineList({ events }: { events: TrackingEvent[] }) {
  // Newest-first, and only stages that have actually happened — matches
  // how Shiprocket/Velocity's own tracking pages read (their latest scan
  // at top, nothing shown for a leg that hasn't happened yet), rather
  // than the old oldest-first list with grayed-out future stages visible
  // the whole way down.
  const happened = events.filter((e) => e.state !== "pending");
  const reversed = [...happened].reverse();

  const currentIdx = reversed.findIndex((e) => e.state === "current" || e.state === "exception");
  const shown = reversed;

  // The "what's next" preview row was removed at Gate 5 (decision D6).
  //
  // Every per-stage date a customer sees must refer to something that
  // ALREADY happened. A greyed next-step row carries an implied date, and
  // an implied date reads as a promise — which is the exact conversation
  // the delay rule exists to prevent. The single arrival estimate in the
  // hero is now the only forward-looking claim on the page.
  //
  // currentIdx is still computed above; it drives phase grouping.
  void currentIdx;

  // A flat 12+ row log reads as a log; a handful of named chapters reads
  // as a story. Group consecutive rows (including the upcoming preview,
  // which belongs to a phase too) into per-phase segments, each its own
  // short <ol> — a phase header can't sit inside <ol> as a bare element
  // (only <li> is valid there), so each phase gets its own list rather
  // than one continuous one with headers spliced in.
  type Segment = { phase: string; rows: React.ReactElement[] };
  const segments: Segment[] = [];
  const pushRow = (phase: string, node: React.ReactElement) => {
    const seg = segments[segments.length - 1];
    if (seg && seg.phase === phase) seg.rows.push(node);
    else segments.push({ phase, rows: [node] });
  };
  shown.forEach((event, i) => {
    pushRow(
        STAGE_PHASE[event.stage],
        <EventRow key={`${event.stage}-${i}`} event={event} index={i} last={i === shown.length - 1} />,
    );
  });

  return (
      <div className="mt-5 sm:mt-6">
        {segments.map((seg, i) => (
            <div key={seg.phase + i}>
              <p className={cx("text-eyebrow text-ink-tertiary uppercase", i === 0 ? "mb-3" : "mt-2 mb-3 border-t border-hairline pt-6")}>
                {seg.phase}
              </p>
              <ol>{seg.rows}</ol>
            </div>
        ))}
      </div>
  );
}

export function RouteBar({ shipment }: { shipment: Shipment }) {
  const reduce = useReducedMotion();
  const tone = statusStyle(shipment.status);
  const mode = modeStyle(shipment.mode);
  const live = isLive(shipment.status);
  // Same "Forwarded to Courier" = handed_to_courier terminal state as the
  // header ETA card above — once handed off, our own ETA clock no longer
  // applies, so this strip shouldn't keep showing a countdown against a
  // date that's already passed its meaning (see the header card's own note).
  const delivered = shipment.status === "Forwarded to Courier";
  // Same "already arrived, stop counting down to that same date" fix as
  // the header ETA card — "At Warehouse"/"Received" both mean the order
  // is already sitting at Vashi.
  const arrivedAtVashi = delivered || ["At Warehouse", "Received"].includes(shipment.status);
  const ModeIcon =
      shipment.mode === "Ocean Freight" ? Ship
          : shipment.mode === "Express Air" ? Truck
              : Plane;
  // The route line otherwise only ever showed a bare % — accurate but not
  // informative on its own, since "47%" doesn't say WHAT'S happening.
  // Surface the current stage's short label right at the marker instead.
  const currentEvent = shipment.events.find((e) => e.state === "current" || e.state === "exception");
  const currentStageLabel = currentEvent ? STAGES.find((s) => s.key === currentEvent.stage)?.short : undefined;

  return (
      <div>
        {/* No card chrome of its own — RouteBar renders INSIDE a
            CardSection now. Keeping its old wrapper would nest a card in
            a card and pay the padding twice, which is precisely the
            horizontal squeeze guardrail 2 exists to prevent. */}
        {/*
          GUARDRAIL 5 (design §3b). Below 640px this is a COLUMN: origin,
          then destination, then the track. Above it, the original
          three-across row.

          Three elements competing for one 360px line — two port names
          plus a percentage pill — is the single highest-risk overflow on
          the page. "DotConnects Logistics USA Warehouse — Newark, NJ" is
          a real value in this field, and truncation only started at sm:.
        */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            {/* Origin is a solid filled dot — already departed, behind the
                shipment now — vs. destination's hollow ring, which fills
                in only once actually arrived. Real state, not a
                decorative bullet pair. */}
            <span className="flex size-2.5 shrink-0 items-center justify-center sm:size-3">
              <span className="size-2 rounded-full bg-ink-tertiary sm:size-2.5" />
            </span>
            <div className="min-w-0">
              <p className="text-eyebrow text-ink-tertiary uppercase">Origin</p>
              <p className="truncate text-[11px] text-ink-subtle sm:text-caption">{shipment.originPort}</p>
            </div>
          </div>
          <div className="order-last flex w-full items-center gap-2 sm:order-none sm:mt-2 sm:w-auto sm:flex-1 sm:px-2 sm:gap-3">
            <div className="h-px flex-1 bg-hairline-strong" />
            <span className={cx("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap", tone.pill)}>
              {shipment.progress}%
            </span>
            <div className="h-px flex-1 bg-hairline-strong" />
          </div>
          <div className="flex min-w-0 flex-row-reverse items-center justify-end gap-2 sm:flex-row sm:gap-2.5">
            <div className="min-w-0 text-left sm:text-right">
              <p className="text-eyebrow text-ink-tertiary uppercase">Destination</p>
              <p className="truncate text-[11px] text-ink-subtle sm:text-caption">{shipment.destinationPort}</p>
            </div>
            <span
                className={cx(
                    "flex size-2.5 shrink-0 items-center justify-center rounded-full border-2 sm:size-3",
                    arrivedAtVashi ? "border-primary bg-primary" : "border-ink-tertiary bg-transparent",
                )}
            />
          </div>
        </div>

        {/* progress track — reads as an actual ROUTE, not a loading bar:
            the remaining leg is a dotted line (like a flight path on a
            map), the traveled leg is a solid one. A plain filled capsule
            with a circle on top is the single most default "progress
            bar" shape in every component library — this is deliberately
            not that. The marker also carries the current stage's own
            short label right underneath it, not just a bare % — a
            number alone doesn't say WHAT'S happening. */}
        {/*
          overflow-x-clip, not hidden: the marker is absolutely
          positioned at left:{progress}% and carries a whitespace-nowrap
          label underneath. At low or high progress both extend past the
          container edge — at 5% the label starts at a negative offset,
          at 95% it runs off the right — which is a horizontal scrollbar
          on a 360px screen.

          `clip` rather than `hidden` because `hidden` would create a
          scroll container and break the pulse-ring and idle-bob
          animations that deliberately overflow the marker's own box.
        */}
        <div className="relative mt-8 overflow-x-clip pb-8 sm:mt-10 sm:pb-9">
          {/* Mode-specific backdrop, faint and CSS-only (no image assets,
              theme-safe) — clouds drifting for air freight, waves for
              ocean, a road's dashed center-line for last-mile. Purely
              atmospheric: sits well behind the track/marker/label, never
              competes with them for attention. Each backdrop layer clips
              itself (rounded-full / its own bounds) rather than the whole
              track wrapper, so the marker can still slide flush to the
              0%/100% edges without getting cut off. */}
          {shipment.mode === "Ocean Freight" ? (
              // A real repeating wave curve (SVG, tiled horizontally) —
              // a CSS radial-gradient trick can't produce an actual sine
              // shape, only concentric dots, so this needed a genuine
              // path rather than a gradient approximation.
              <div
                  aria-hidden
                  className="aurora-a pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-8 -translate-y-1/2 opacity-30"
                  style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='32' viewBox='0 0 64 32'%3E%3Cpath d='M0 16c4 0 4-12 8-12s4 12 8 12 4-12 8-12 4 12 8 12 4-12 8-12 4 12 8 12 4-12 8-12 4 12 8 12' fill='none' stroke='%233f8ff0' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "repeat-x",
                    backgroundSize: "64px 32px",
                  }}
              />
          ) : shipment.mode === "Express Air" ? (
              // A road's dashed center-line, thicker and more legible
              // than the route track's own thinner dash above it.
              <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[5px] -translate-y-1/2 rounded-full opacity-40"
                  style={{
                    backgroundImage: "repeating-linear-gradient(90deg, var(--color-vivid-amber) 0 16px, transparent 16px 30px)",
                  }}
              />
          ) : (
              <div aria-hidden className="aurora-b pointer-events-none absolute inset-x-0 -top-3 -z-10 h-20 opacity-25">
                <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                          "radial-gradient(ellipse 70px 26px at 15% 40%, var(--color-vivid-blue), transparent 70%)," +
                          "radial-gradient(ellipse 90px 30px at 50% 65%, var(--color-vivid-blue), transparent 70%)," +
                          "radial-gradient(ellipse 65px 24px at 85% 35%, var(--color-vivid-blue), transparent 70%)",
                    }}
                />
              </div>
          )}
          <div className="flex h-10 items-center sm:h-12">
            <div
                aria-hidden
                className="h-[3px] w-full rounded-full"
                style={{
                  backgroundImage: "repeating-linear-gradient(90deg, var(--color-hairline-strong) 0 5px, transparent 5px 11px)",
                }}
            />
            <motion.div
                aria-hidden
                className="absolute left-0 h-[3px] rounded-full"
                style={{ background: `linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 45%, transparent), var(--color-primary))` }}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${shipment.progress}%` }}
                transition={{ duration: 1.2, ease: EASE }}
            />
          </div>
          <motion.div
              className="absolute top-5 flex -translate-x-1/2 flex-col items-center sm:top-6"
              initial={reduce ? false : { left: "6%" }}
              // Clamped to 6-94%. An unclamped 0% or 100% puts half the
              // 40px marker outside the track before its label is even
              // considered. The visual cost is a couple of percent; the
              // alternative is a marker hanging off the edge.
              animate={{ left: `${Math.min(94, Math.max(6, shipment.progress))}%` }}
              transition={{ duration: 1.2, ease: EASE }}
          >
            <span className="relative flex size-10 -translate-y-1/2 items-center justify-center sm:size-12">
              {live ? (
                  <span className={cx("pulse-ring absolute inline-flex size-full rounded-full", mode.dot)} />
              ) : null}
              {/* A small continuous bob once it's parked at its progress
                  position — while `live`, the shipment really is still
                  moving day to day even though this single page-load
                  can't show that motion in real time, so a gentle idle
                  bob reads as "still in motion" rather than the marker
                  looking stranded the instant the load-in animation
                  finishes. */}
              <motion.span
                  animate={live && !reduce ? { y: [0, -3, 0] } : undefined}
                  transition={live && !reduce ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : undefined}
              >
              <span
                  className={cx(
                      "relative flex size-10 items-center justify-center rounded-full border-[3px] border-surface-1 shadow-lg sm:size-12",
                      mode.pill,
                  )}
              >
              <ModeIcon className="size-4 sm:size-5" strokeWidth={2.2} />
            </span>
              </motion.span>
            </span>
            {currentStageLabel ? (
                <span className={cx("mt-1 max-w-[40vw] truncate rounded-full border px-2 py-0.5 text-center text-[10px] font-semibold shadow-xs sm:max-w-none sm:whitespace-nowrap", tone.pill)}>
                  {currentStageLabel}
                </span>
            ) : null}
          </motion.div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-hairline pt-4 text-caption text-ink-subtle sm:mt-8 sm:pt-5">
          <span>Ordered {shipment.shippedOn}</span>
          <span className="flex items-center gap-1.5">
          <Clock className="size-3" strokeWidth={2} />
            {delivered ? (
                <>
                  Handed off to courier{" "}
                  <span className={cx("font-semibold", tone.text)}>
                    {shipment.lastMileCourier ?? ""}
                  </span>
                </>
            ) : arrivedAtVashi ? (
                <span className={cx("font-semibold", tone.text)}>Arrived at Vashi hub</span>
            ) : (
                <>
                  ETA{" "}
                  <span className={cx("font-semibold", tone.text)}>
                    {relativeDays(shipment.eta) ?? shipment.eta}
                  </span>
                </>
            )}
        </span>
        </div>
      </div>
  );
}

export default function ShipmentDetail({ shipment }: { shipment: Shipment }) {
  const reduceMotion = useReducedMotion();
  // "Received" (qc_check) is QC-passed at Vashi, not doorstep delivery —
  // "Forwarded to Courier" (handed_to_courier) is this app's real terminal
  // tracked state; see lib/greeting.ts's identical fix for the same reason.
  const delivered   = shipment.status === "Forwarded to Courier";

  // G2 — overdue (architecture §6). `eta` is deliberately EMPTY when
  // overdue, so without this branch the hero renders a blank where the
  // biggest number on the page should be. The customer gets a clear
  // message instead of a missing date.
  const overdue = shipment.isOverdue === true;

  // G3 — damaged in transit (Gate 5). A hold state outside the timeline;
  // the parcel has stopped moving and a replacement may exist.
  const damaged = shipment.status === "Damaged in transit";
  const vashiEvent = shipment.events.find((e) => e.stage === "at_vashi_warehouse");
  const qcEvent = shipment.events.find((e) => e.stage === "qc_check");
  // Three distinct real sub-stages once at Vashi, not one merged "arrived"
  // state — "At Warehouse" (just landed), "Received" (QC passed, waiting
  // on last-mile), "Forwarded to Courier" (handed_to_courier) each get
  // their own label + real timestamp, matching the same specificity the
  // timeline events below already show.
  const vashiSubStage =
    shipment.status === "At Warehouse"
      ? { label: "At Dropy Vashi warehouse", event: vashiEvent }
      : shipment.status === "Received"
        ? { label: "QC check — done", event: qcEvent }
        : null;
  const etaRelative = relativeDays(shipment.eta);
  const handoverEvent = shipment.events.find((e) => e.stage === "handed_to_courier");
  const tone        = statusStyle(shipment.status);
  const greeting    = orderGreeting(shipment, etaRelative);
  const { copied, copy } = useCopy(shipment.id);
  const iconColor   = statusVar(shipment.status);

  const shipmentModeIcon =
      shipment.mode === "Ocean Freight" ? Ship
          : shipment.mode === "Express Air" ? Truck
              : Plane;
  const facts: [LucideIcon, string, string][] = [
    [User,      "Customer",       `${shipment.consignee} · ${shipment.consigneeCity}`],
    [shipmentModeIcon, "Shipping mode",  shipment.mode],
    [Landmark,  "Carrier",        shipment.carrier],
    [Package,   "Items",          `${shipment.skuCount} products`],
    [Scale,     "Weight",         `${shipment.weightKg.toLocaleString("en-IN")} kg`],
    [IndianRupee, "Declared value", usdToInrFormatted(shipment.declaredValueUsd)],
  ];
  if (shipment.containerOrAwb && shipment.containerOrAwb !== "—") {
    facts.push([Container, "AWB / Container", shipment.containerOrAwb]);
  }
  if (shipment.lastMileCourier && shipment.lastMileAwb) {
    facts.push([Truck, "Last-mile courier", `${shipment.lastMileCourier} — ${shipment.lastMileAwb}`]);
  }

  return (
      <motion.div
          className="relative"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
      >
        {/*
          C2 Option B — card sections (chosen at Gate 5).

          Note for whoever reads this next: the PREVIOUS layout removed
          the outer card deliberately, on the grounds that repeated card
          chrome is "the generic dashboard tell". That reasoning is sound
          and was overridden by an explicit product decision, not an
          oversight. Cards are back, but under the six mobile guardrails
          in docs/05-design.md §3b — because card padding is exactly what
          eats the horizontal space that causes clipping.

          GUARDRAIL 1: edge-to-edge below 640px (-mx-4, hairline top and
          bottom, no side border), rounded with margins from sm: up.
          GUARDRAIL 2: 16px padding on mobile, 24-28px above.
          GUARDRAIL 3: nothing sits side by side inside a card below 640px.
        */}
        <div className="flex flex-col gap-3 sm:gap-4">

          {/* ── 1. Status + arrival ────────────────────────── */}
          <Card>
            <div className="relative overflow-hidden">
              <div
                  aria-hidden
                  className="aurora-a pointer-events-none absolute -inset-1/3 -z-10 blur-3xl"
                  style={{ background: `radial-gradient(circle at 75% 20%, color-mix(in srgb, ${iconColor} 45%, transparent), transparent 60%)` }}
              />
              <p className="text-body-sm text-ink-subtle">
                <span className="font-display font-semibold text-ink">{greeting.salutation}</span>
                {" "}{greeting.message}
              </p>

              {shipment.lastMileTrackingUrl && shipment.lastMileCourier && (
                <LastMileTrackingLink
                  courier={shipment.lastMileCourier}
                  url={shipment.lastMileTrackingUrl}
                />
              )}

              <div className="mt-5">
                <p className="text-eyebrow uppercase" style={{ color: iconColor }}>
                  {damaged ? "Damaged in transit"
                    : overdue ? "Taking longer than expected"
                    : delivered ? "Handed off to courier"
                    : vashiSubStage ? vashiSubStage.label
                    : "Est. arrival at our Vashi hub"}
                </p>
                <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
                >
                  {damaged ? (
                    <>
                      <p className="font-display text-headline font-bold text-semantic-alert sm:text-display-md">
                        We&apos;re sorting this out
                      </p>
                      <p className="mt-2 text-body-sm text-ink-muted">
                        Your parcel was damaged on its way to India. Our team has
                        already been notified and will contact you about a
                        replacement.
                      </p>
                    </>
                  ) : overdue ? (
                    <>
                      {/* No date. An overdue parcel's arrival is genuinely
                          unknown, and printing a guess is what turns a
                          delay into a broken promise. */}
                      <p className="font-display text-headline font-bold text-semantic-warn sm:text-display-md">
                        Still on its way
                      </p>
                      <p className="mt-2 text-body-sm text-ink-muted">
                        This parcel is taking longer than our usual window. We&apos;re
                        chasing it with our shipping partner — please contact Dropy
                        support for the latest update.
                      </p>
                    </>
                  ) : delivered ? (
                    <>
                      <p className={cx("font-display text-headline font-bold sm:text-display-md", tone.text)}>
                        {handoverEvent?.timestamp ?? "Complete"}
                      </p>
                      {shipment.lastMileTrackingUrl ? (
                        <a
                          href={shipment.lastMileTrackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-flex min-h-11 items-center gap-1 text-caption font-medium text-primary hover:text-primary-hover hover:underline"
                        >
                          Delivery ETA on {shipment.lastMileCourier}
                          <ArrowRight className="size-3" strokeWidth={2} />
                        </a>
                      ) : (
                        <p className="mt-1.5 text-caption text-ink-tertiary">Complete</p>
                      )}
                    </>
                  ) : vashiSubStage ? (
                      <p className={cx("font-display text-headline font-bold sm:text-display-md", tone.text)}>
                        {vashiSubStage.event?.timestamp ?? "Complete"}
                      </p>
                  ) : (
                    <>
                      <p className={cx("font-display text-headline font-bold sm:text-display-md", tone.text)}>
                        {etaRelative ?? shipment.eta}
                      </p>
                      {etaRelative ? (
                          <p className="mt-1.5 text-caption text-ink-tertiary">{shipment.eta}</p>
                      ) : null}
                    </>
                  )}
                </motion.div>
              </div>

              {/*
                GUARDRAIL 3 + 4. Stacked below 640px, wrapped above. The
                tracking ID uses break-all: an 18-character unbroken
                string is the classic cause of horizontal scroll, and it
                has nowhere natural to wrap.
              */}
              <div className="mt-5 flex flex-col gap-2 border-t border-hairline pt-4 text-caption sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:pt-5">
                <button
                    type="button"
                    onClick={copy}
                    className="group flex min-h-11 items-center gap-1.5 text-left transition-transform active:scale-95 active:opacity-70 sm:min-h-0"
                    title="Copy tracking ID"
                >
                  <span className="shrink-0 text-ink-tertiary">Tracking</span>
                  <span className="font-mono text-mono break-all text-ink">{shipment.id}</span>
                  {copied
                      ? <Check className="size-3 shrink-0 text-semantic-success" strokeWidth={2.5} />
                      : <Copy className="size-3 shrink-0 text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.8} />
                  }
                </button>
                <span className="flex items-center gap-1.5">
                  <span className="shrink-0 text-ink-tertiary">Order</span>
                  <span className="font-mono text-mono break-all text-ink-subtle">{shipment.reference}</span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusPill status={shipment.status} courier={shipment.lastMileCourier} />
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-ink-subtle">
                  <Package className="size-3.5 shrink-0 text-ink-tertiary" strokeWidth={1.8} />
                  <span className="truncate">{shipment.consignee}</span>
                </span>
              </div>
            </div>
          </Card>

          {/* ── 2. Route ───────────────────────────────────── */}
          <CardSection title="Route">
            <RouteBar shipment={shipment} />
          </CardSection>

          {/* ── 3. Journey so far ──────────────────────────────
              "so far", not "Journey" — the list ends at the current
              stage (D6), and a heading that promises the whole journey
              would make a short list read as truncated rather than
              accurate. */}
          <CardSection title="Journey so far">
            <TimelineList events={shipment.events ?? []} />
          </CardSection>

          {/* ── 4. Shipment details ───────────────────────────
              Kept from the previous layout (inventory §5). Counts,
              weight and total value only — never product names, which
              were removed deliberately as brand disclosure (§7.1). */}
          <CardSection title="Shipment details">
            <dl className="divide-y divide-hairline">
              {facts.map(([Icon, k, v]) => (
                  <div key={k} className="flex items-start gap-3 py-3 sm:items-center sm:gap-3.5">
                    <span className="flex size-8 shrink-0 items-center justify-center text-ink-tertiary">
                      <Icon className="size-4" strokeWidth={1.8} />
                    </span>
                    {/* GUARDRAIL 3: label above value on mobile, beside
                        it from sm: up. */}
                    <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
                      <dt className="text-caption text-ink-tertiary sm:w-40 sm:shrink-0">{k}</dt>
                      <dd className="min-w-0 text-body-sm font-medium break-words text-ink-muted">{v}</dd>
                    </div>
                  </div>
              ))}
            </dl>
          </CardSection>

          {/* ── 5. Need help — expanded, not an accordion ──── */}
          <CardSection title="Need help?">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-ink">Question about this shipment?</p>
                <p className="mt-0.5 text-caption text-ink-tertiary">Our team responds within 4 business hours.</p>
              </div>
              <a
                  href={`mailto:${COMPANY.email}`}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-hairline-strong bg-surface-2 px-4 text-body-sm font-medium text-ink-subtle transition-all hover:-translate-y-px hover:border-primary hover:text-ink active:translate-y-0 active:scale-[0.98]"
              >
                <Mail className="size-3.5" strokeWidth={1.8} />
                Email support
              </a>
            </div>
          </CardSection>
        </div>
      </motion.div>
  );
}

/* ─── Card shells ─────────────────────────────────────
   GUARDRAIL 1: edge-to-edge below 640px. No side borders and a negative
   horizontal margin, so card padding doesn't eat the page gutter on top
   of its own — that double-padding is what squeezes content and causes
   the clipping cards are otherwise prone to.
   GUARDRAIL 2: 16px padding on mobile, 24px+ above.
   ───────────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="-mx-4 border-y border-hairline bg-surface-1 p-4 sm:mx-0 sm:rounded-2xl sm:border sm:p-6 md:p-7">
      {children}
    </section>
  );
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="-mx-4 border-y border-hairline bg-surface-1 sm:mx-0 sm:rounded-2xl sm:border">
      <h3 className="border-b border-hairline px-4 py-3 text-eyebrow uppercase text-ink-tertiary sm:px-6">
        {title}
      </h3>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}
