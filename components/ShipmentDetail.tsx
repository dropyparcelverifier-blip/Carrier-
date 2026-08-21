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
  History,
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
  Ship,
  Truck,
  Warehouse,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { nextStage, nextStageLabel, STAGES, usdToInrFormatted, type Shipment, type StageKey, type TrackingEvent } from "@/lib/types";
import { isLive, modeStyle, statusStyle } from "@/lib/status";
import { relativeDays } from "@/lib/dates";
import { orderGreeting } from "@/lib/greeting";
import { EASE } from "./motion/primitives";
import { cx } from "./ui";
import { COMPANY } from "@/lib/company";

/* ── Copy hook ── */
function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
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

  // What comes after the current stage — the timeline otherwise only ever
  // shows what's already happened, so "what's next" was unanswerable.
  // Not shown once delivered (currentIdx === -1, e.g. "Forwarded to
  // Courier" has no "current" event left) or mid-exception (an unresolved
  // problem shouldn't imply a normal next-step preview).
  const upcoming =
      currentIdx !== -1 && reversed[currentIdx].state === "current"
          ? nextStage(reversed[currentIdx].stage)
          : null;

  return (
      <div className="mt-5 sm:mt-6 sm:pl-1">
        <ol>
          {upcoming ? <NextStageRow stage={upcoming.key} label={nextStageLabel(upcoming.key)} /> : null}
          {shown.map((event, i) => (
              <EventRow
                  key={`${event.stage}-${i}`}
                  event={event}
                  index={i}
                  last={i === shown.length - 1}
              />
          ))}
        </ol>
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
      <div className="rounded-2xl border border-hairline bg-surface-1 p-4 sm:p-6 md:p-7">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
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
              <p className="text-[11px] text-ink-subtle sm:truncate sm:text-caption">{shipment.originPort}</p>
            </div>
          </div>
          <div className="mt-1.5 flex flex-1 items-center gap-2 px-2 sm:mt-2 sm:gap-3">
            <div className="h-px flex-1 bg-hairline-strong" />
            <span className={cx("rounded-full border px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap", tone.pill)}>
              {shipment.progress}%
            </span>
            <div className="h-px flex-1 bg-hairline-strong" />
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <div className="min-w-0 text-right">
              <p className="text-eyebrow text-ink-tertiary uppercase">Destination</p>
              <p className="text-[11px] text-ink-subtle sm:truncate sm:text-caption">{shipment.destinationPort}</p>
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
        <div className="relative mt-8 pb-8 sm:mt-10 sm:pb-9">
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
              initial={reduce ? false : { left: "0%" }}
              animate={{ left: `${shipment.progress}%` }}
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
                <span className={cx("mt-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap shadow-xs", tone.pill)}>
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

  const facts: [string, string][] = [
    ["Customer",       `${shipment.consignee} · ${shipment.consigneeCity}`],
    ["Shipping mode",  shipment.mode],
    ["Carrier",        shipment.carrier],
    ["Items",          `${shipment.skuCount} products`],
    ["Weight",         `${shipment.weightKg.toLocaleString("en-IN")} kg`],
    ["Declared value", usdToInrFormatted(shipment.declaredValueUsd)],
  ];
  if (shipment.containerOrAwb && shipment.containerOrAwb !== "—") {
    facts.push(["AWB / Container", shipment.containerOrAwb]);
  }
  if (shipment.lastMileCourier && shipment.lastMileAwb) {
    facts.push(["Last-mile courier", `${shipment.lastMileCourier} — ${shipment.lastMileAwb}`]);
  }

  return (
      <motion.div
          className="relative"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
      >
        {/* No outer card — this used to be one big bordered/shadowed box
            with everything nested inside it, which is exactly the
            "generic dashboard" tell no amount of internal polish fixes.
            Content now sits directly on the page canvas; hierarchy comes
            from a real hero band, a full-bleed timeline spine, and
            whitespace/hairline rules between sections, not repeated
            card chrome. */}

        {/* ── Hero: status + ETA, one unified band ── */}
        <div className="relative overflow-hidden rounded-[28px] border border-hairline bg-surface-1">
          {/* .aurora-a already carries its own theme-aware opacity
              (globals.css dims it in light mode) — a Tailwind opacity-*
              utility here would win the cascade and override that
              dimming, so intensity is tuned via the gradient's own color
              stop instead of a competing opacity class. This is now the
              ONE ambient glow on the page, behind the ONE hero band. */}
          <div
              aria-hidden
              className="aurora-a pointer-events-none absolute -inset-1/3 -z-10 blur-3xl"
              style={{ background: `radial-gradient(circle at 75% 20%, color-mix(in srgb, ${iconColor} 45%, transparent), transparent 60%)` }}
          />
          <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ background: statusVar(shipment.status) }}
          />

          <div className="p-5 sm:p-7 md:p-9">
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

            {/* ETA is the actual answer to "where's my stuff" — it leads on
                every viewport now (not just mobile), set in the biggest
                type on the page, with the ID/status fields as plain
                inline-labeled text beneath it rather than a competing
                sibling tile. */}
            <div className="mt-5 sm:mt-6">
              <p className="text-eyebrow uppercase" style={{ color: iconColor }}>
                {delivered ? "Handed off to courier" : vashiSubStage ? vashiSubStage.label : "Est. arrival at our Vashi hub"}
              </p>
              <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
              >
                {delivered ? (
                  <>
                    <p className={cx("font-display text-headline font-bold sm:text-display-md", tone.text)}>
                      {handoverEvent?.timestamp ?? "Complete"}
                    </p>
                    {shipment.lastMileTrackingUrl ? (
                      <a
                        href={shipment.lastMileTrackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-caption font-medium text-primary hover:text-primary-hover hover:underline"
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

            {/* ID / status / consignee — plain inline fields under the
                hero number, not sibling boxes competing with it. */}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-4 text-caption sm:mt-7 sm:pt-5">
              <button
                  type="button"
                  onClick={copy}
                  className="group flex items-center gap-1.5 transition-transform active:scale-95 active:opacity-70"
                  title="Copy tracking ID"
              >
                <span className="text-ink-tertiary">Tracking</span>
                <span className="font-mono text-mono text-ink">{shipment.id}</span>
                {copied
                    ? <Check className="size-3 text-semantic-success" strokeWidth={2.5} />
                    : <Copy className="size-3 text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.8} />
                }
              </button>
              <span className="flex items-center gap-1.5">
                <span className="text-ink-tertiary">Order</span>
                <span className="font-mono text-mono text-ink-subtle">{shipment.reference}</span>
              </span>
              <StatusPill status={shipment.status} courier={shipment.lastMileCourier} />
              {/* Brand chips ("CeraVe", "Wavytalk", ...) removed —
                  standalone chips read as an official brand association
                  the same way the ORIGIN field did when it showed a
                  vendor's name as if they operated our facility. The
                  product's real name still appears naturally in the
                  Items list further down, which is accurate description,
                  not a branded chip. */}
              <span className="flex items-center gap-1.5 text-ink-subtle">
                <Package className="size-3.5 shrink-0 text-ink-tertiary" strokeWidth={1.8} />
                {shipment.consignee}
              </span>
            </div>
          </div>
        </div>

        {/* ── Route — a horizontal journey strip, sitting on its own,
            not nested in another card ── */}
        <div className="mt-6 sm:mt-8">
          <RouteBar shipment={shipment} />
        </div>

        {/* ── Tracking history — the vertical timeline is the page's
            actual spine now: no wrapping card, its connector line just
            runs down the page. ── */}
        <div className="mt-10 border-t border-hairline pt-8 sm:mt-12 sm:pt-10">
          <h3 className="flex items-center gap-2 text-body font-semibold text-ink sm:gap-2.5">
            <History className="size-4 text-ink-tertiary" strokeWidth={1.8} />
            Tracking history
          </h3>
          <TimelineList events={shipment.events ?? []} />
        </div>

        {/* Items in this order — removed. Individual product names read
            as unauthorized brand disclosure the same way the standalone
            brand chips did (see the earlier chip-removal note above);
            Declared value in the Shipment details accordion below still
            covers the total value without naming specific products. */}

        {/* ── Shipment details accordion ── */}
        <details className="faq-item group mt-10 border-t border-hairline pt-8 sm:mt-12 sm:pt-10">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-body-sm font-semibold text-ink marker:hidden">
          <span className="flex items-center gap-2 sm:gap-2.5">
            <ChevronDown
                className="size-4 text-ink-tertiary transition-transform duration-300 group-open:rotate-180"
                strokeWidth={1.8}
            />
            Shipment details
          </span>
          </summary>
          <div className="faq-item-body grid transition-[grid-template-rows] duration-400 ease-out">
            <div className="min-h-0 overflow-hidden">
              {/* Flat bordered grid, not a raised tile per cell — a fact
                  table reads as one coherent form when its cells share
                  hairline rules, not as N separate decisions each
                  wrapped in its own soft-shadow box. Cells still size to
                  their own content (auto-fit/minmax) since "Items: 1
                  products" and "Customer: Sandeep Kumar · Delhi" don't
                  need the same column width. */}
              <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-0 overflow-hidden rounded-2xl border-t border-l border-hairline sm:mt-6">
                {facts.map(([k, v]) => (
                    <div key={k} className="border-r border-b border-hairline px-3.5 py-3 transition-colors hover:bg-surface-2/50 sm:px-4 sm:py-3.5">
                      <dt className="text-eyebrow text-ink-tertiary uppercase">{k}</dt>
                      <dd className="mt-1.5 truncate text-body-sm font-medium text-ink-muted">{v}</dd>
                    </div>
                ))}
              </dl>
            </div>
          </div>
        </details>

        {/* ── Support footer ── */}
        <div className="mt-10 flex flex-col items-start gap-3 border-t border-hairline pt-8 sm:mt-12 sm:flex-row sm:items-center sm:justify-between sm:pt-10">
          <div>
            <p className="text-body-sm font-medium text-ink">Question about this shipment?</p>
            <p className="mt-0.5 text-caption text-ink-tertiary">Our team responds within 4 business hours.</p>
          </div>
          <a
              href={`mailto:${COMPANY.email}`}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border border-hairline-strong bg-surface-2 px-4 text-body-sm font-medium text-ink-subtle transition-all hover:-translate-y-px hover:border-primary hover:text-ink hover:shadow-[0_6px_16px_-8px_var(--color-primary)] active:translate-y-0 active:scale-[0.98]"
          >
            <Mail className="size-3.5" strokeWidth={1.8} />
            Email support
          </a>
        </div>
      </motion.div>
  );
}