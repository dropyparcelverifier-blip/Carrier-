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

function StatusPill({ status }: { status: Shipment["status"] }) {
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
          <p className="mt-0.5 flex items-center gap-1.5 text-caption text-ink-tertiary">
            <MapPin className="size-3 shrink-0" strokeWidth={1.8} />
            <span className="truncate">{event.location}</span>
          </p>
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
  const ModeIcon =
      shipment.mode === "Ocean Freight" ? Ship
          : shipment.mode === "Express Air" ? Truck
              : Plane;

  return (
      <div>
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
          <span className="neuro-surface neuro-pressed-sm flex size-5 shrink-0 items-center justify-center rounded-full sm:size-6">
            <span className="size-1.5 rounded-full bg-ink-tertiary sm:size-2" />
          </span>
            <span className="truncate text-[11px] text-ink-subtle sm:text-caption">{shipment.originPort}</span>
          </div>
          <ArrowRight className="size-3 shrink-0 text-ink-tertiary sm:size-3.5" strokeWidth={1.5} />
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-right text-[11px] text-ink-subtle sm:text-caption">{shipment.destinationPort}</span>
            <span className="neuro-surface neuro-raised flex size-5 shrink-0 items-center justify-center rounded-full sm:size-6">
            <span className="size-1.5 rounded-full bg-primary sm:size-2" />
          </span>
          </div>
        </div>

        {/* progress groove — inline gradient avoids Tailwind purge */}
        <div className="neuro-surface neuro-pressed-sm relative mt-4 h-3 rounded-full sm:mt-5">
          <motion.div
              className="absolute inset-y-0 left-0 rounded-full shadow-sm"
              style={{ background: accentGradient(shipment.status) }}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${shipment.progress}%` }}
              transition={{ duration: 1.2, ease: EASE }}
          />
          <motion.span
              aria-hidden
              className="absolute top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center sm:size-10"
              initial={reduce ? false : { left: "0%" }}
              animate={{ left: `${shipment.progress}%` }}
              transition={{ duration: 1.2, ease: EASE }}
          >
            {live ? (
                <span className={cx("pulse-ring absolute inline-flex size-full rounded-full", mode.dot)} />
            ) : null}
            <span className={cx(
                "neuro-surface neuro-raised relative flex size-8 items-center justify-center rounded-full border-2 border-transparent sm:size-10",
                mode.pill,
            )}>
            <ModeIcon className="size-3 sm:size-4" strokeWidth={2} />
          </span>
          </motion.span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-2 sm:mt-5 sm:gap-x-3">
          <span className="text-caption text-ink-tertiary">Ordered {shipment.shippedOn}</span>
          <span className={cx("rounded-full border px-3 py-1 text-caption font-semibold", tone.pill)}>
          {shipment.progress}% complete
        </span>
          <span className="flex items-center gap-1.5 text-caption text-ink-subtle">
          <Clock className="size-3" strokeWidth={2} />
          ETA{" "}
            <span className={cx("font-semibold", tone.text)}>
            {relativeDays(shipment.eta) ?? shipment.eta}
          </span>
        </span>
        </div>
      </div>
  );
}

export default function ShipmentDetail({ shipment }: { shipment: Shipment }) {
  const delivered   = shipment.status === "Received";
  const etaRelative = relativeDays(shipment.eta);
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

  const items        = shipment.items ?? [];
  const itemsTotalUsd = items.reduce((sum: number, i: any) => sum + (i.price_usd ?? 0), 0);
  const previewFacts = [shipment.carrier, `${shipment.weightKg} kg`, `${shipment.skuCount} SKUs`].filter(Boolean);

  return (
      <motion.div
          className="edge-lift relative overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-xl sm:rounded-3xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
      >
        {/* coloured top accent bar */}
        <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-1 rounded-t-2xl sm:rounded-t-3xl"
            style={{ background: accentGradient(shipment.status) }}
        />

        <div className="relative z-[1] p-4 pt-6 sm:p-6 sm:pt-8 md:p-8 md:pt-10">

          {/* ── Greeting banner ── */}
          <div
              className="mb-6 flex items-start gap-3 rounded-xl p-4 sm:gap-4 sm:rounded-2xl sm:p-5"
              style={greetingBg(shipment.status)}
          >
          <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10"
              style={{
                color: iconColor,
                background: `color-mix(in srgb, ${iconColor} 14%, transparent)`,
              }}
          >
            <Sparkles className="size-4 sm:size-5" strokeWidth={1.8} />
          </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-body font-semibold text-ink">{greeting.salutation}</p>
              <p className="mt-1 text-body-sm text-ink-subtle">{greeting.message}</p>
            </div>
          </div>

          {/* ── Header ── */}
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={copy}
                    className="neuro-surface neuro-pressed-sm group flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                    title="Copy tracking ID"
                >
                  <span className="font-mono text-mono text-ink-subtle">{shipment.id}</span>
                  {copied
                      ? <Check className="size-3 text-semantic-success" strokeWidth={2.5} />
                      : <Copy className="size-3 text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.8} />
                  }
                </button>
                <StatusPill status={shipment.status} />
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-ink-subtle">
                <Package className="size-3.5 shrink-0 text-ink-tertiary" strokeWidth={1.8} />
                {shipment.consignee}
                <span className="text-hairline-strong">·</span>
                Order {shipment.reference}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {shipment.brands.map((b) => (
                    <span key={b} className="neuro-surface neuro-raised rounded-full px-2.5 py-1 text-caption text-ink-subtle">
                  {b}
                </span>
                ))}
              </div>
            </div>

            {/* ETA card */}
            <div className="neuro-surface neuro-raised flex items-center justify-between gap-4 rounded-xl px-4 py-3.5 sm:block sm:min-w-[160px] sm:rounded-2xl sm:px-6 sm:py-5 sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                {delivered ? "Delivered" : "Estimated delivery"}
              </p>
              <div className="sm:mt-2">
                <p className={cx("font-display font-bold text-title sm:text-headline", tone.text)}>
                  {etaRelative ?? shipment.eta}
                </p>
                {etaRelative ? (
                    <p className="text-caption text-ink-tertiary sm:mt-1">{shipment.eta}</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* ── Route bar ── */}
          <div className="neuro-surface neuro-pressed mt-6 rounded-xl p-4 sm:mt-8 sm:rounded-2xl sm:p-6">
            <RouteBar shipment={shipment} />
          </div>

          {/* ── Tracking history ── */}
          <div className="mt-7 border-t border-hairline pt-6 sm:mt-9 sm:pt-8">
            <h3 className="flex items-center gap-2 text-body font-semibold text-ink sm:gap-2.5">
            <span
                className="flex size-7 items-center justify-center rounded-lg sm:size-8 sm:rounded-xl"
                style={{
                  color: iconColor,
                  background: `color-mix(in srgb, ${iconColor} 12%, transparent)`,
                }}
            >
              <History className="size-4" strokeWidth={1.8} />
            </span>
              Tracking history
            </h3>
            <TimelineList events={shipment.events ?? []} />
          </div>

          {/* ── Items ── */}
          {items.length > 0 ? (
              <div className="mt-7 border-t border-hairline pt-6 sm:mt-9 sm:pt-8">
                <h3 className="flex items-center gap-2 text-body font-semibold text-ink sm:gap-2.5">
              <span
                  className="flex size-7 items-center justify-center rounded-lg sm:size-8 sm:rounded-xl"
                  style={{
                    color: iconColor,
                    background: `color-mix(in srgb, ${iconColor} 12%, transparent)`,
                  }}
              >
                <Package className="size-4" strokeWidth={1.8} />
              </span>
                  Items in this order
                </h3>
                <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:gap-2.5">
                  {items.map((item: any, i: number) => (
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
                        className="mt-3 flex items-center justify-between rounded-xl px-4 py-3 sm:mt-3.5 sm:rounded-2xl sm:px-5"
                        style={{
                          background: "color-mix(in srgb, var(--color-semantic-success) 8%, var(--color-surface-1))",
                          border: "1px solid color-mix(in srgb, var(--color-semantic-success) 22%, transparent)",
                        }}
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
          <details className="faq-item group mt-7 border-t border-hairline pt-6 sm:mt-9 sm:pt-8">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-body-sm font-semibold text-ink marker:hidden">
            <span className="flex items-center gap-2 sm:gap-2.5">
              <span className="neuro-surface neuro-raised flex size-7 items-center justify-center rounded-lg text-ink-tertiary sm:size-8 sm:rounded-xl">
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
          <div className="mt-7 overflow-hidden rounded-xl sm:mt-9 sm:rounded-2xl">
            <div aria-hidden className="h-1" style={{ background: accentGradient(shipment.status) }} />
            <div className="neuro-surface neuro-pressed flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
              <div>
                <p className="text-body-sm font-medium text-ink">Question about this shipment?</p>
                <p className="mt-0.5 text-caption text-ink-tertiary">Our team responds within 4 business hours.</p>
              </div>
              <a
                  href={`mailto:${COMPANY.email}`}
                  className="neuro-surface neuro-raised inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-body-sm font-medium text-ink-subtle hover:text-ink"
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