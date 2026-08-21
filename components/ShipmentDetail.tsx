"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  History,
  MapPin,
  Mail,
  Package,
  Plane,
  Ship,
  Truck,
  ArrowRight,
} from "lucide-react";
import { nextStage, nextStageLabel, usdToInrFormatted, type Shipment, type TrackingEvent } from "@/lib/types";
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

  return (
      <motion.li
          className={cx(
              "relative flex gap-3 rounded-xl pb-5 transition-colors last:pb-0 sm:gap-4 sm:pb-6",
              // The current stage gets a real background band plus a left
              // accent bar, not just a colored dot — otherwise it reads at
              // the same visual weight as every done/pending row and the
              // "you are here" signal is easy to miss on a 12-event list.
              // Vertical padding only, so the connector line's left offset
              // (tied to the icon column) never has to shift.
              current
                  ? "-my-1 bg-primary/[0.07] py-4 shadow-[inset_2px_0_0_var(--color-primary)]"
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
              <span className="relative flex size-5 items-center justify-center">
            <span className="pulse-ring absolute size-full rounded-full bg-primary/30" />
            <span className="size-3.5 rounded-full bg-primary shadow-glow" />
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

/** A dimmed, dashed-dot preview row for the stage after the current one —
 *  the timeline otherwise only ever shows what's already happened, so
 *  "what's next" was answerable nowhere on the page. Hollow/dashed, not
 *  the solid done-check or pulsing current-dot, so it reads as a third,
 *  distinct "not yet, but coming" state rather than an early done item. */
function NextStageRow({ label }: { label: string }) {
  return (
      <li className="relative flex gap-3 pb-5 opacity-50 sm:gap-4 sm:pb-6">
        <span
            aria-hidden
            className="absolute top-5 bottom-0 left-[9px] w-px bg-hairline"
        />
        <span className="relative z-10 mt-1 flex size-5 shrink-0 items-center justify-center">
          <span className="size-2.5 rounded-full border border-dashed border-ink-tertiary" />
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
          {upcoming ? <NextStageRow label={nextStageLabel(upcoming.key)} /> : null}
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

  return (
      <div>
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <span className="neuro-surface neuro-pressed-sm flex size-6 shrink-0 items-center justify-center rounded-full sm:size-7">
            <span className="size-1.5 rounded-full bg-ink-tertiary sm:size-2" />
          </span>
            <div className="min-w-0">
              <p className="text-eyebrow text-ink-tertiary uppercase">Origin</p>
              <p className="text-[11px] text-ink-subtle sm:truncate sm:text-caption">{shipment.originPort}</p>
            </div>
          </div>
          <ArrowRight className="mt-1.5 size-3 shrink-0 text-ink-tertiary sm:mt-2 sm:size-3.5" strokeWidth={1.5} />
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <div className="min-w-0 text-right">
              <p className="text-eyebrow text-ink-tertiary uppercase">Destination</p>
              <p className="text-[11px] text-ink-subtle sm:truncate sm:text-caption">{shipment.destinationPort}</p>
            </div>
            <span className="neuro-raised-tint flex size-6 shrink-0 items-center justify-center rounded-full sm:size-7" style={{ ["--tint-color" as string]: "var(--color-primary)" }}>
            <span className="size-1.5 rounded-full bg-primary sm:size-2" />
          </span>
          </div>
        </div>

        {/* progress groove — inline gradient avoids Tailwind purge */}
        <div className="neuro-surface neuro-pressed-sm relative mt-6 h-3.5 rounded-full sm:mt-8">
          <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-primary shadow-sm"
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${shipment.progress}%` }}
              transition={{ duration: 1.2, ease: EASE }}
          />
          <motion.span
              aria-hidden
              className="absolute top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center sm:size-11"
              initial={reduce ? false : { left: "0%" }}
              animate={{ left: `${shipment.progress}%` }}
              transition={{ duration: 1.2, ease: EASE }}
          >
            <span
                className={cx(
                    "neuro-raised-tint relative flex size-9 items-center justify-center rounded-full border-2 border-surface-1 shadow-md sm:size-11",
                    mode.pill,
                )}
                style={{ ["--tint-color" as string]: "currentColor" }}
            >
            <ModeIcon className="size-3.5 sm:size-4.5" strokeWidth={2} />
          </span>
          </motion.span>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-2 gap-y-2 sm:mt-7 sm:gap-x-3">
          <span className="text-caption text-ink-tertiary">Ordered {shipment.shippedOn}</span>
          <span className={cx("rounded-full border px-3 py-1 text-caption font-semibold shadow-xs", tone.pill)}>
          {shipment.progress}% complete
        </span>
          <span className="flex items-center gap-1.5 text-caption text-ink-subtle">
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
          className="gradient-border edge-lift relative overflow-hidden rounded-[28px] border border-hairline bg-surface-1 shadow-xl sm:rounded-[32px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
      >
        {/* Status color now lives in exactly two places: this thin top
            bar and the ETA card below — not the ambient glow, greeting
            banner, or history icon that used to also carry it. Flat
            fill, not a gradient, so "what color is this" stays legible. */}
        <div
            aria-hidden
            className="absolute inset-x-0 top-0 z-[2] h-1.5 rounded-t-[28px] sm:rounded-t-[32px]"
            style={{ background: statusVar(shipment.status) }}
        />

        <div className="relative z-[1] p-4 pt-7 sm:p-7 sm:pt-9 md:p-9 md:pt-11">

          {/* ── Greeting ── */}
          {/* Plain text, not a card — this is welcome copy, not status
              data, so it shouldn't out-weigh the ETA card below it. One
              line combining salutation + message where they fit together;
              the message still wraps to a second line on narrow screens
              rather than truncating. */}
          <p className="mb-4 text-body-sm text-ink-subtle sm:mb-5">
            <span className="font-display font-semibold text-ink">{greeting.salutation}</span>
            {" "}{greeting.message}
          </p>
          {shipment.lastMileTrackingUrl && shipment.lastMileCourier && (
            <LastMileTrackingLink
              courier={shipment.lastMileCourier}
              url={shipment.lastMileTrackingUrl}
            />
          )}

          {/* ── Header ──
              ETA is the actual answer to "where's my stuff", so on mobile
              it renders first (flex-col-reverse) — the ID/status chips
              and consignee line follow below it, not above. On md+ where
              both sit side by side already, the order flips back to the
              natural reading order (chips left, ETA right). */}
          <div className="flex flex-col-reverse gap-5 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="min-w-0 flex-1">
              {/* Tracking ID / Order ID / Status as distinct labeled
                  fields, not one run-together line — each gets its own
                  caption so a reader can tell at a glance which number is
                  which, instead of the tracking ID and order ID looking
                  like the same kind of thing separated only by a bullet. */}
              <div className="flex flex-wrap items-stretch gap-2.5">
                <div className="rounded-lg border border-hairline bg-surface-2/60 px-3 py-2">
                  <p className="text-eyebrow text-ink-tertiary uppercase">Tracking ID</p>
                  <button
                      type="button"
                      onClick={copy}
                      className="group mt-1 flex items-center gap-1.5 transition-transform active:scale-95 active:opacity-70"
                      title="Copy tracking ID"
                  >
                    <span className="font-mono text-mono text-ink">{shipment.id}</span>
                    {copied
                        ? <Check className="size-3 text-semantic-success" strokeWidth={2.5} />
                        : <Copy className="size-3 text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.8} />
                    }
                  </button>
                </div>
                <div className="rounded-lg border border-hairline bg-surface-2/60 px-3 py-2">
                  <p className="text-eyebrow text-ink-tertiary uppercase">Order ID</p>
                  <p className="mt-1 font-mono text-mono text-ink-subtle">{shipment.reference}</p>
                </div>
                <div className="flex flex-col justify-between rounded-lg border border-hairline bg-surface-2/60 px-3 py-2">
                  <p className="text-eyebrow text-ink-tertiary uppercase">Status</p>
                  <div className="mt-1">
                    <StatusPill status={shipment.status} courier={shipment.lastMileCourier} />
                  </div>
                </div>
              </div>
              {/* Brand chips ("CeraVe", "Wavytalk", ...) removed —
                  standalone chips read as an official brand association
                  the same way the ORIGIN field did when it showed a
                  vendor's name as if they operated our facility. The
                  product's real name still appears naturally in the
                  Items list further down, which is accurate description,
                  not a branded chip. */}
              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-ink-subtle">
                <Package className="size-3.5 shrink-0 text-ink-tertiary" strokeWidth={1.8} />
                {shipment.consignee}
              </p>
            </div>

            {/* ETA card — the one true focal point on the whole page. Every
                other icon/button/cell is flat (see below); this is the
                only surface that gets neumorphic depth AND an ambient
                glow, so the tactile treatment reads as "this is the
                answer" instead of "every element gets the same coat of
                paint." The glow sits in an outer, non-clipping wrapper —
                putting it INSIDE the card (behind its own opaque
                background) made it invisible, since a glow needs to bleed
                past the card's edges onto the page to read at all. Reuses
                globals.css's existing drift-a keyframe (already
                reduced-motion-safe) rather than adding a parallel
                animation. Always a column (label above value), not
                row-on-mobile — the "delivered" branch renders two lines
                (timestamp + a tracking link), which an items-center row
                can't hold without clipping the second line against the
                row's height. */}
            <div className="relative shrink-0 sm:min-w-[190px]">
              {/* .aurora-a already carries its own theme-aware opacity
                  (globals.css dims it in light mode) — a Tailwind
                  opacity-* utility here would win the cascade and
                  override that dimming, so intensity is tuned via the
                  gradient's own color stop instead of a competing
                  opacity class. */}
              <div
                  aria-hidden
                  className="aurora-a pointer-events-none absolute -inset-6 -z-10 blur-2xl"
                  style={{ background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${iconColor} 70%, transparent), transparent 65%)` }}
              />
              <div
                  className="neuro-raised-tint relative flex flex-col items-stretch gap-1 rounded-2xl px-5 py-4 sm:px-6 sm:py-5 sm:text-right"
                  style={{ ["--tint-color" as string]: iconColor }}
              >
              {/* "Estimated delivery" reads as doorstep delivery, but the
                  date underneath (order_date + shipping_days*1.2) is
                  actually when the order reaches qc_check — arrival at
                  our Vashi hub, not the customer's door. Once it's actually
                  ARRIVED there (At Warehouse / Received / Forwarded to
                  Courier), a live countdown toward that same date is a
                  contradiction with the timeline showing "Received at
                  Vashi warehouse" right below it — so this shows the real
                  arrival timestamp instead. Once handed off, OUR eta is no
                  longer meaningful at all — the real remaining transit
                  time only exists on the courier's own tracking page (both
                  Shiprocket and Velocity's deep links are confirmed
                  working, see the link above), so that state shows the
                  real handover date instead. */}
              <p className="text-eyebrow text-ink-tertiary uppercase">
                {delivered ? "Handed off to courier" : vashiSubStage ? vashiSubStage.label : "Est. arrival at our Vashi hub"}
              </p>
              <div className="sm:mt-1.5">
                {delivered ? (
                  <>
                    <p className={cx("font-display text-card-title font-bold sm:text-headline", tone.text)}>
                      {handoverEvent?.timestamp ?? "Complete"}
                    </p>
                    {shipment.lastMileTrackingUrl ? (
                      <a
                        href={shipment.lastMileTrackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-caption font-medium text-primary hover:text-primary-hover hover:underline sm:mt-1.5 sm:justify-end"
                      >
                        Delivery ETA on {shipment.lastMileCourier}
                        <ArrowRight className="size-3" strokeWidth={2} />
                      </a>
                    ) : (
                      <p className="mt-0.5 text-caption text-ink-tertiary sm:mt-1.5">Complete</p>
                    )}
                  </>
                ) : vashiSubStage ? (
                    <p className={cx("font-display text-card-title font-bold sm:text-headline", tone.text)}>
                      {vashiSubStage.event?.timestamp ?? "Complete"}
                    </p>
                ) : (
                  <>
                    <p className={cx("font-display text-card-title font-bold sm:text-headline", tone.text)}>
                      {etaRelative ?? shipment.eta}
                    </p>
                    {etaRelative ? (
                        <p className="mt-0.5 text-caption text-ink-tertiary sm:mt-1.5">{shipment.eta}</p>
                    ) : null}
                  </>
                )}
              </div>
              </div>
            </div>
          </div>

          {/* ── Route bar ── */}
          <div className="neuro-surface neuro-pressed mt-6 rounded-2xl p-4 sm:mt-8 sm:p-6 md:p-7">
            <RouteBar shipment={shipment} />
          </div>

          {/* ── Tracking history ── */}
          <div className="mt-8 border-t border-hairline pt-7 sm:mt-10 sm:pt-9">
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
          <details className="faq-item group mt-8 border-t border-hairline pt-7 sm:mt-10 sm:pt-9">
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
          <div className="glass mt-8 overflow-hidden rounded-2xl shadow-sm sm:mt-10">
            <div className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
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
          </div>

        </div>
      </motion.div>
  );
}