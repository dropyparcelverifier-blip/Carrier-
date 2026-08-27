"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
    ArrowRight,
    Calculator,
    Clock4,
    IndianRupee,
    Info,
    MapPin,
    Package,
} from "lucide-react";
import { ORIGINS } from "@/lib/network";
import { estimateQuote, MIN_CHARGEABLE_KG } from "@/lib/quote";
import { COMPANY } from "@/lib/company";
import { EASE } from "./motion/primitives";
import { Button, ButtonLink, cx, IconTile } from "./ui";

const inr = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
});

const WEIGHT_PRESETS = [1, 2.5, 5, 10, 20];

function StepBadge({ n, tone }: { n: number; tone: "primary" | "blue" | "amber" }) {
    const TONE_BG: Record<string, string> = {
        primary: "bg-primary/15 text-primary",
        blue: "bg-vivid-blue/15 text-vivid-blue",
        amber: "bg-vivid-amber/15 text-vivid-amber",
    };
    return (
        <span
            className={cx(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold",
                TONE_BG[tone],
            )}
        >
      {n}
    </span>
    );
}

function EmptyState() {
    const steps = [
        { n: 1, label: "Origin", color: "bg-primary/10 text-primary border-primary/20" },
        { n: 2, label: "Weight", color: "bg-vivid-blue/10 text-vivid-blue border-vivid-blue/20" },
        { n: 3, label: "Category", color: "bg-vivid-amber/10 text-vivid-amber border-vivid-amber/20" },
    ];

    return (
        <div className="gradient-border edge-lift relative flex h-full min-h-64 flex-col items-center justify-center gap-7 overflow-hidden rounded-xl border border-hairline bg-surface-1 p-8 text-center shadow-lg">

            {/* ── background photo: aerial cargo port ── */}
            <img
                aria-hidden
                src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=900&q=80&auto=format&fit=crop"
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.08] mix-blend-luminosity"
            />

            {/* white fade so content stays legible */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top opacity-[0.04] mix-blend-luminosity grayscale"
            />

            {/* ambient orbs — sit above photo, below content */}
            <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-48 rounded-full bg-vivid-amber/10 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-12 size-48 rounded-full bg-primary/10 blur-3xl" />

            {/* ── content (all relative so it sits above bg layers) ── */}

            {/* top label */}
            <p className="relative text-[10px] font-semibold uppercase tracking-widest text-ink-tertiary">
                Estimate preview
            </p>

            {/* icon with glow */}
            <div className="relative flex items-center justify-center">
                <div className="absolute size-20 rounded-full bg-vivid-amber/15 blur-xl" />
                <div className="absolute size-14 rounded-full bg-vivid-amber/10 blur-md" />
                <div className="relative">
                    <IconTile icon={Calculator} tone="amber" />
                </div>
            </div>

            {/* heading + body */}
            <div className="relative flex flex-col gap-1.5">
                <p className="text-body-sm font-semibold text-ink">
                    Your estimate appears here
                </p>
                <p className="max-w-[210px] text-caption text-ink-tertiary">
                    Complete the three steps on the left, then hit{" "}
                    <span className="font-medium text-ink-subtle">Get an estimate</span>.
                </p>
            </div>

            {/* step pills */}
            <div className="relative flex flex-wrap justify-center gap-2">
                {steps.map(({ n, label, color }) => (
                    <span
                        key={n}
                        className={cx(
                            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium",
                            color,
                        )}
                    >
            <span className="flex size-4 items-center justify-center rounded-full bg-current/20 text-[9px] font-bold">
              {n}
            </span>
                        {label}
          </span>
                ))}
            </div>

            {/* dashed divider */}
            <div className="relative flex w-full max-w-[200px] items-center gap-2 text-ink-tertiary">
                <div className="h-px flex-1 border-t border-dashed border-hairline" />
                <ArrowRight className="size-3 shrink-0" strokeWidth={1.8} />
                <div className="h-px flex-1 border-t border-dashed border-hairline" />
            </div>

            {/* you'll see card */}
            <div className="relative w-full max-w-[240px] rounded-lg border border-hairline bg-surface-1/80 px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                    You'll see
                </p>
                <div className="mt-2 flex flex-col gap-1.5">
                    {[
                        { dot: "bg-vivid-green", label: "Total freight cost (₹)" },
                        { dot: "bg-vivid-blue", label: "Transit window" },
                        { dot: "bg-vivid-amber", label: "Gateway route" },
                    ].map(({ dot, label }) => (
                        <div key={label} className="flex items-center gap-2">
                            <span className={cx("size-1.5 shrink-0 rounded-full", dot)} />
                            <span className="text-caption text-ink-tertiary">{label}</span>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}

export default function QuoteClient() {
    const params = useSearchParams();
    const reduce = useReducedMotion();

    const initialOrigin =
        ORIGINS.find((o) => o.gateway === params.get("origin"))?.country ??
        ORIGINS[0].country;

    const [origin, setOrigin] = useState(initialOrigin);
    const [weight, setWeight] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const weightKg = Number(weight);
    const validWeight = weight.trim() !== "" && weightKg > 0;

    const estimate = useMemo(() => {
        if (!submitted || !validWeight) return null;
        return estimateQuote(origin, weightKg);
    }, [submitted, validWeight, origin, weightKg]);

    return (
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            {/* ── Form ── */}
            <div className="gradient-border edge-lift relative overflow-hidden rounded-xl border border-hairline bg-surface-1 p-6 shadow-lg md:p-8">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        setSubmitted(true);
                    }}
                    className="flex flex-col gap-6"
                >
                    <div>
                        <label className="flex items-center gap-2 text-body-sm font-medium text-ink">
                            <StepBadge n={1} tone="primary" />
                            Origin market
                        </label>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {ORIGINS.map((o, i) => (
                                <button
                                    key={o.country}
                                    type="button"
                                    aria-pressed={origin === o.country}
                                    onClick={() => {
                                        setOrigin(o.country);
                                        setSubmitted(false);
                                    }}
                                    className={cx(
                                        "neuro-surface flex min-h-11 items-center gap-2 rounded-md border px-3 py-2.5 text-body-sm transition-all duration-200 active:scale-95",
                                        origin === o.country
                                            ? "neuro-pressed-sm border-primary/40 text-primary"
                                            : "neuro-raised border-transparent text-ink-subtle hover:text-ink",
                                        i === ORIGINS.length - 1 && ORIGINS.length % 2 === 1 && "col-span-2 sm:col-span-1",
                                    )}
                                >
                                    <img
                                        src={o.flagSrc}
                                        alt=""
                                        className="h-3 w-[18px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/15"
                                    />
                                    <span className="truncate">{o.flag}</span>
                                </button>
                            ))}
                        </div>
                        <p className="mt-2 text-caption text-ink-tertiary">
                            Shipping from somewhere else? These are our main markets — email{" "}
                            <a href={`mailto:${COMPANY.email}`} className="font-medium text-primary hover:underline">
                                {COMPANY.email}
                            </a>{" "}
                            and we&rsquo;ll quote your country.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="quote-weight" className="flex items-center gap-2 text-body-sm font-medium text-ink">
                            <StepBadge n={2} tone="blue" />
                            Shipment weight (kg)
                        </label>
                        <div className="relative mt-3">
                            <Package
                                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-tertiary"
                                strokeWidth={1.9}
                            />
                            <input
                                id="quote-weight"
                                type="number"
                                min={0.1}
                                step={0.1}
                                inputMode="decimal"
                                value={weight}
                                onChange={(e) => {
                                    setWeight(e.target.value);
                                    setSubmitted(false);
                                }}
                                placeholder="e.g. 12"
                                className="neuro-surface neuro-pressed-sm min-h-11 w-full rounded-md border border-transparent pr-3 pl-10 text-body-sm text-ink placeholder:text-ink-tertiary focus:border-primary/40 focus:outline-none"
                            />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {WEIGHT_PRESETS.map((w) => (
                                <button
                                    key={w}
                                    type="button"
                                    aria-pressed={weightKg === w}
                                    onClick={() => {
                                        setWeight(String(w));
                                        setSubmitted(false);
                                    }}
                                    className={cx(
                                        "min-h-9 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors duration-200",
                                        weightKg === w
                                            ? "border-vivid-blue/40 bg-vivid-blue/10 text-vivid-blue"
                                            : "border-hairline text-ink-tertiary hover:text-ink",
                                    )}
                                >
                                    {w}kg
                                </button>
                            ))}
                        </div>
                        <p className="mt-2.5 text-caption text-ink-tertiary">
                            Minimum chargeable weight is {MIN_CHARGEABLE_KG}kg. We accept a
                            single carton — it&rsquo;s billed at the {MIN_CHARGEABLE_KG}kg floor.
                        </p>
                    </div>


                    <Button type="submit" size="lg" icon={ArrowRight} disabled={!validWeight}>
                        Get an estimate
                    </Button>
                    {!validWeight && weight.trim() !== "" ? (
                        <p className="text-caption text-semantic-alert" role="alert">
                            Enter a weight greater than zero.
                        </p>
                    ) : null}
                </form>
            </div>

            {/* ── Result ── */}
            <div aria-live="polite">
                {estimate ? (
                    <motion.div
                        key={`${estimate.origin.country}-${estimate.weightKg}`}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: EASE }}
                        className="gradient-border edge-lift relative overflow-hidden rounded-xl border border-hairline bg-surface-1 p-6 shadow-lg md:p-8"
                    >
                        <p className="text-caption text-ink-tertiary">
                            Indicative estimate — not a locked quote
                        </p>

                        <p className="mt-4 bg-gradient-to-br from-primary via-primary to-accent bg-clip-text font-display text-[clamp(36px,4.5vw,52px)] leading-none font-semibold tracking-[-0.03em] text-transparent">
                            {inr.format(estimate.totalInr)}
                        </p>
                        <p className="mt-2 text-body-sm text-ink-subtle">
                            {estimate.weightKg}kg from {estimate.origin.country} ·
                            billed at {estimate.chargeableKg}kg
                        </p>
                        {estimate.chargeableKg > estimate.weightKg ? (
                            <p className="mt-1 text-caption text-ink-tertiary">
                                Billed at the {estimate.chargeableKg}kg minimum chargeable weight.
                            </p>
                        ) : null}

                        <dl className="mt-6 flex flex-col gap-3 border-t border-hairline pt-5">
                            <div className="flex items-center justify-between gap-3">
                                <dt className="flex items-center gap-2.5 text-body-sm text-ink-subtle">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-vivid-green/15 text-vivid-green">
                    <IndianRupee className="size-3.5" strokeWidth={2} />
                  </span>
                                    Freight
                                </dt>
                                <dd className="font-mono text-body-sm text-ink">
                                    {inr.format(estimate.freightInr)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className="flex items-center gap-2.5 text-body-sm text-ink-subtle">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-vivid-blue/15 text-vivid-blue">
                    <Package className="size-3.5" strokeWidth={2} />
                  </span>
                                    Handling &amp; documentation
                                </dt>
                                <dd className="font-mono text-body-sm text-ink">
                                    {inr.format(estimate.handlingInr)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className="flex items-center gap-2.5 text-body-sm text-ink-subtle">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-vivid-amber/15 text-vivid-amber">
                    <Clock4 className="size-3.5" strokeWidth={2} />
                  </span>
                                    Transit
                                </dt>
                                <dd className="text-body-sm text-ink">{estimate.transitLabel}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className="flex items-center gap-2.5 text-body-sm text-ink-subtle">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-vivid-coral/15 text-vivid-coral">
                    <MapPin className="size-3.5" strokeWidth={2} />
                  </span>
                                    Gateway
                                </dt>
                                <dd className="font-mono text-body-sm text-ink">
                                    {estimate.origin.gateway} → BOM
                                </dd>
                            </div>
                        </dl>

                        <div className="neuro-surface neuro-raised mt-6 flex items-start gap-3 rounded-lg border border-transparent p-4">
                            <Info className="mt-0.5 size-4 shrink-0 text-ink-tertiary" strokeWidth={1.8} />
                            <p className="text-caption text-ink-tertiary">
                                This does not include duty, IGST or MRP labelling, and doesn&rsquo;t
                                account for dangerous-goods certification on fragrance lines.
                                Send the SKU list for a real number.
                            </p>
                        </div>

                        <ButtonLink
                            href={`mailto:${COMPANY.email}?subject=${encodeURIComponent(
                                `Rate request — ${estimate.origin.country}, ${estimate.weightKg}kg`,
                            )}`}
                            variant="secondary"
                            size="lg"
                            icon={ArrowRight}
                            className="mt-5 w-full"
                        >
                            Send SKU list for a real quote
                        </ButtonLink>
                    </motion.div>
                ) : (
                    <EmptyState />
                )}
            </div>
        </div>
    );
}