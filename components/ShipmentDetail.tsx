"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  ChevronsUpDown,
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
  Sparkles,
  Truck,
  ArrowRight,
} from "lucide-react";
import { usdToInrFormatted, type Shipment, type TrackingEvent } from "@/lib/types";
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

/* ── Greeting banner bg ── */
function greetingBg(status: Shipment["status"]): React.CSSProperties {
  const c = statusVar(status);
  return {
    background: `color-mix(in srgb, ${c} 11%, var(--color-surface-1))`,
    border: `1px solid color-mix(in srgb, ${c} 26%, transparent)`,
  };
}

/* ── Accent bar + progress bar gradient ── */
function accentGradient(status: Shipment["status"]): string {
  const c = statusVar(status);
  const c2 = status === "Customs Clearance"
      ? "var(--color-accent)"
      : status === "Received"
          ? "color-mix(in srgb, var(--color-semantic-success) 60%, var(--color-primary))"
          : status === "At Warehouse"
              ? "var(--color-primary)"
              : "var(--color-primary-hover)";
  return `linear-gradient(90deg, color-mix(in srgb, ${c} 80%, transparent), ${c}, ${c2})`;
}

export function StatusPill({ status }: { status: Shipment["status"] }) {
  const tone = statusStyle(status);
  const live = isLive(status);
  return (
      <span className={cx(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-medium sm:gap-2 sm:px-3",
          tone.pill,
      )}>
      <span className="relative flex size-1.5">
        {live ? <span className={cx("pulse-ring absolute inline-flex size-full rounded-full", tone.dot)} /> : null}
        <span className={cx("relative inline-flex size-1.5 rounded-full", tone.dot)} />
      </span>
        {status}
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
          className="relative flex gap-3 pb-5 last:pb-0 sm:gap-4 sm:pb-6"
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
        {current ? <span className="pulse-ring absolute inline-flex size-full rounded-full bg-primary" /> : null}
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

function TimelineList({ events }: { events: TrackingEvent[] }) {
  const currentIdx = events.findIndex((e) => e.state === "current" || e.state === "exception");
  const pivot = currentIdx === -1 ? 0 : Math.max(0, currentIdx - 1);
  const collapsible = pivot > 2;
  const [open, setOpen] = useState(false);

  const showAll    = !collapsible || open;
  const hiddenCount = showAll ? 0 : pivot;
  const shown      = showAll ? events : events.slice(pivot);

  return (
      <div className="mt-5 sm:mt-6 sm:pl-1">
        {hiddenCount > 0 ? (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="neuro-surface neuro-pressed mb-5 flex min-h-12 w-full items-center gap-2.5 rounded-xl px-3.5 text-caption text-ink-subtle hover:text-ink sm:gap-3 sm:px-4"
            >
          <span className="neuro-pressed-sm flex size-6 shrink-0 items-center justify-center rounded-full text-ink-tertiary">
            <ChevronsUpDown className="size-3.5" strokeWidth={1.8} />
          </span>
              <span className="text-left">Show {hiddenCount} earlier updates</span>
              <span className="ml-auto hidden shrink-0 items-center gap-1.5 text-ink-tertiary sm:flex">
            <CheckCircle2 className="size-3 text-semantic-success" strokeWidth={2} />
            all complete
          </span>
              <CheckCircle2 className="ml-auto size-3.5 shrink-0 text-semantic-success sm:hidden" strokeWidth={2} />
            </button>
        ) : null}
        <ol>
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
  // Same "Out for Delivery" = handed_to_courier terminal state as the
  // header ETA card above — once handed off, our own ETA clock no longer
  // applies, so this strip shouldn't keep showing a countdown against a
  // date that's already passed its meaning (see the header card's own note).
  const delivered = shipment.status === "Out for Delivery";
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
              <p className="text-[9px] font-semibold tracking-wider text-ink-tertiary uppercase sm:text-[10px]">Origin</p>
              <p className="text-[11px] text-ink-subtle sm:truncate sm:text-caption">{shipment.originPort}</p>
            </div>
          </div>
          <ArrowRight className="mt-1.5 size-3 shrink-0 text-ink-tertiary sm:mt-2 sm:size-3.5" strokeWidth={1.5} />
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <div className="min-w-0 text-right">
              <p className="text-[9px] font-semibold tracking-wider text-ink-tertiary uppercase sm:text-[10px]">Destination</p>
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
              className="absolute inset-y-0 left-0 rounded-full shadow-sm"
              style={{ background: accentGradient(shipment.status) }}
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
            {live ? (
                <span className={cx("pulse-ring absolute inline-flex size-full rounded-full", mode.dot)} />
            ) : null}
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
  // "Out for Delivery" (handed_to_courier) is this app's real terminal
  // tracked state; see lib/greeting.ts's identical fix for the same reason.
  const delivered   = shipment.status === "Out for Delivery";
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

  const items        = shipment.items ?? [];
  const itemsTotalUsd = items.reduce((sum, i) => sum + (i.price_usd ?? 0), 0);
  const previewFacts = [shipment.carrier, `${shipment.weightKg} kg`, `${shipment.skuCount} SKUs`].filter(Boolean);

  return (
      <motion.div
          className="gradient-border edge-lift relative overflow-hidden rounded-[28px] border border-hairline bg-surface-1 shadow-xl sm:rounded-[32px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
      >
        {/* ambient tone wash — sits behind everything, gives the whole card a
            coloured "glow from within" instead of relying on the 1px accent
            bar alone to signal status */}
        <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 z-0 size-72 rounded-full opacity-[0.14] blur-3xl sm:size-96"
            style={{ background: statusVar(shipment.status) }}
        />

        {/* coloured top accent bar */}
        <div
            aria-hidden
            className="absolute inset-x-0 top-0 z-[2] h-1.5 rounded-t-[28px] sm:rounded-t-[32px]"
            style={{ background: accentGradient(shipment.status) }}
        />

        <div className="relative z-[1] p-4 pt-7 sm:p-7 sm:pt-9 md:p-9 md:pt-11">

          {/* ── Greeting banner (glass) ── */}
          {/* mb-5/p-3.5 on mobile (not mb-6/p-4) — this banner is welcome
              text, not the status data itself, so it gets slightly less
              vertical space there specifically to keep the route bar and
              handover timestamp below it from resting entirely behind the
              floating BottomNav on first paint (confirmed via real pixel
              measurement: the route bar was 100% covered at scroll 0
              before this trim — see BottomNav.tsx's own note on its
              floating footprint). */}
          <div
              className="glass relative mb-5 flex items-start gap-3 overflow-hidden rounded-2xl p-3.5 shadow-sm sm:mb-8 sm:gap-4 sm:rounded-[20px] sm:p-5"
              style={greetingBg(shipment.status)}
          >
          <span
              className="neuro-raised-tint flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-11 sm:rounded-2xl"
              style={{
                color: iconColor,
                ["--tint-color" as string]: iconColor,
              }}
          >
            <Sparkles className="size-4.5 sm:size-5" strokeWidth={1.8} />
          </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-body font-semibold text-ink sm:text-body-lg">{greeting.salutation}</p>
              <p className="mt-1 text-body-sm text-ink-subtle">{greeting.message}</p>
              {shipment.lastMileTrackingUrl && shipment.lastMileCourier && (
                <LastMileTrackingLink
                  courier={shipment.lastMileCourier}
                  url={shipment.lastMileTrackingUrl}
                />
              )}
            </div>
          </div>

          {/* ── Header ── */}
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="min-w-0 flex-1">
              {/* Tracking ID / Order ID / Status as distinct labeled
                  fields, not one run-together line — each gets its own
                  caption so a reader can tell at a glance which number is
                  which, instead of the tracking ID and order ID looking
                  like the same kind of thing separated only by a bullet. */}
              <div className="flex flex-wrap items-stretch gap-2.5">
                <div className="rounded-lg border border-hairline bg-surface-2/60 px-3 py-2">
                  <p className="text-[10px] font-semibold tracking-wider text-ink-tertiary uppercase">Tracking ID</p>
                  <button
                      type="button"
                      onClick={copy}
                      className="group mt-1 flex items-center gap-1.5 transition-opacity active:opacity-70"
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
                  <p className="text-[10px] font-semibold tracking-wider text-ink-tertiary uppercase">Order ID</p>
                  <p className="mt-1 font-mono text-mono text-ink-subtle">{shipment.reference}</p>
                </div>
                <div className="flex flex-col justify-between rounded-lg border border-hairline bg-surface-2/60 px-3 py-2">
                  <p className="text-[10px] font-semibold tracking-wider text-ink-tertiary uppercase">Status</p>
                  <div className="mt-1">
                    <StatusPill status={shipment.status} />
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

            {/* ETA card — floats as its own raised tile, tinted by status.
                Always a column (label above value), not row-on-mobile —
                the "delivered" branch renders two lines (timestamp + a
                tracking link), which an items-center row can't hold
                without clipping the second line against the row's height. */}
            <div
                className="neuro-raised-tint flex shrink-0 flex-col items-stretch gap-1 rounded-2xl px-5 py-4 sm:min-w-[190px] sm:rounded-[22px] sm:px-6 sm:py-5 sm:text-right"
                style={{ ["--tint-color" as string]: iconColor }}
            >
              {/* "Estimated delivery" reads as doorstep delivery, but the
                  date underneath (order_date + shipping_days*1.4) is
                  actually when the order reaches qc_check — arrival at
                  our Vashi hub, not the customer's door. Once handed off,
                  OUR eta is no longer meaningful at all — the real
                  remaining transit time only exists on the courier's own
                  tracking page (both Shiprocket and Velocity's deep links
                  are confirmed working, see the link above), so this
                  shows the real handover date instead of a stale/expired
                  countdown against a date that's no longer relevant. */}
              <p className="text-[10px] font-semibold tracking-wider text-ink-tertiary uppercase">
                {delivered ? "Handed off to courier" : "Est. arrival at our Vashi hub"}
              </p>
              <div className="sm:mt-1.5">
                {delivered ? (
                  <>
                    <p className={cx("font-display text-title font-bold sm:text-headline", tone.text)}>
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
                ) : (
                  <>
                    <p className={cx("font-display text-title font-bold sm:text-headline", tone.text)}>
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

          {/* ── Route bar ── */}
          <div className="neuro-surface neuro-pressed mt-6 rounded-2xl p-4 sm:mt-8 sm:rounded-[22px] sm:p-6 md:p-7">
            <RouteBar shipment={shipment} />
          </div>

          {/* ── Tracking history ── */}
          <div className="mt-8 border-t border-hairline pt-7 sm:mt-10 sm:pt-9">
            <h3 className="flex items-center gap-2.5 text-body font-semibold text-ink sm:gap-3">
            <span
                className="neuro-surface neuro-raised flex size-8 items-center justify-center rounded-xl sm:size-9 sm:rounded-2xl"
                style={{ color: iconColor }}
            >
              <History className="size-4" strokeWidth={1.8} />
            </span>
              Tracking history
            </h3>
            <TimelineList events={shipment.events ?? []} />
          </div>

          {/* ── Items ── */}
          {items.length > 0 ? (
              <div className="mt-8 border-t border-hairline pt-7 sm:mt-10 sm:pt-9">
                <h3 className="flex items-center gap-2.5 text-body font-semibold text-ink sm:gap-3">
              <span
                  className="neuro-surface neuro-raised flex size-8 items-center justify-center rounded-xl sm:size-9 sm:rounded-2xl"
                  style={{ color: iconColor }}
              >
                <Package className="size-4" strokeWidth={1.8} />
              </span>
                  Items in this order
                </h3>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:mt-5 sm:gap-2.5 md:grid-cols-2">
                  {items.map((item, i) => (
                      <div
                          key={i}
                          className="neuro-surface neuro-pressed-sm flex items-start justify-between gap-3 rounded-xl px-3.5 py-3 sm:items-center sm:rounded-2xl sm:px-4 sm:py-3.5"
                      >
                        <div className="min-w-0">
                          <p className="text-body-sm font-medium text-ink">{item.name}</p>
                          <p className="mt-0.5 text-caption text-ink-tertiary">
                            Qty: {item.qty}
                            {item.weight_g ? ` · ${item.weight_g}g` : ""}
                            {item.sku ? ` · ${item.sku}` : ""}
                          </p>
                        </div>
                        {item.price_usd ? (
                            <span className="shrink-0 rounded-full border border-semantic-success/30 bg-semantic-success/8 px-2.5 py-1 font-mono text-caption font-semibold text-semantic-success">
                      {usdToInrFormatted(item.price_usd)}
                    </span>
                        ) : null}
                      </div>
                  ))}
                </div>

                {/* order total */}
                {itemsTotalUsd > 0 ? (
                    <div
                        className="neuro-raised-tint mt-3 flex items-center justify-between rounded-xl px-4 py-3.5 sm:mt-3.5 sm:rounded-2xl sm:px-5"
                        style={{ ["--tint-color" as string]: "var(--color-semantic-success)" }}
                    >
                <span className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "color-mix(in srgb, var(--color-semantic-success) 70%, var(--color-ink-subtle))" }}
                >
                  Order total
                </span>
                      <span className="font-mono text-body-sm font-bold text-semantic-success">
                  {usdToInrFormatted(itemsTotalUsd)}
                </span>
                    </div>
                ) : null}
              </div>
          ) : null}

          {/* ── Shipment details accordion ── */}
          <details className="faq-item group mt-8 border-t border-hairline pt-7 sm:mt-10 sm:pt-9">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-body-sm font-semibold text-ink marker:hidden">
            <span className="flex items-center gap-2.5 sm:gap-3">
              <span className="neuro-surface neuro-raised flex size-8 items-center justify-center rounded-xl text-ink-tertiary sm:size-9 sm:rounded-2xl">
                <ChevronDown
                    className="size-4 transition-transform duration-300 group-open:rotate-180"
                    strokeWidth={1.8}
                />
              </span>
              Shipment details
            </span>
              <span className="flex items-center gap-1.5 group-open:hidden">
              {previewFacts.map((f) => (
                  <span key={f} className="hidden rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[10px] text-ink-tertiary sm:inline-flex">
                  {f}
                </span>
              ))}
            </span>
            </summary>
            <div className="faq-item-body grid transition-[grid-template-rows] duration-400 ease-out">
              <div className="min-h-0 overflow-hidden">
                <dl className="grid grid-cols-2 gap-2 pt-5 sm:gap-3 sm:pt-6 md:grid-cols-3">
                  {facts.map(([k, v]) => (
                      <div key={k} className="neuro-surface neuro-raised rounded-xl px-3.5 py-3 sm:rounded-2xl sm:px-4 sm:py-3.5">
                        <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">{k}</dt>
                        <dd className="mt-1.5 truncate text-body-sm font-medium text-ink-muted">{v}</dd>
                      </div>
                  ))}
                </dl>
              </div>
            </div>
          </details>

          {/* ── Support footer ── */}
          <div className="glass mt-8 overflow-hidden rounded-2xl shadow-sm sm:mt-10">
            <div aria-hidden className="h-1" style={{ background: accentGradient(shipment.status) }} />
            <div className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
              <div>
                <p className="text-body-sm font-medium text-ink">Question about this shipment?</p>
                <p className="mt-0.5 text-caption text-ink-tertiary">Our team responds within 4 business hours.</p>
              </div>
              <a
                  href={`mailto:${COMPANY.email}`}
                  className="neuro-surface neuro-raised inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-body-sm font-medium text-ink-subtle transition-transform hover:text-ink active:scale-[0.98]"
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