import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Calculator,
  ChevronRight,
  Compass,
  Mail,
  Package,
  Phone,
  Plane,
  Radar,
  ShieldCheck, Users,
} from "lucide-react";
import CarrierStrip from "@/components/CarrierStrip";
import FAQAccordion from "@/components/FAQAccordion";
import HeroPhotoBanner from "@/components/HeroPhotoBanner";
import HeroTrackForm from "@/components/HeroTrackForm";
import HowItMoves from "@/components/HowItMoves";
import LaneTable from "@/components/LaneTable";
import LiveFeed from "@/components/LiveFeed";
import NetworkMap from "@/components/NetworkMap";
import ReviewCarousel from "@/components/ReviewCarousel";
import GlowOrb from "@/components/fx/GlowOrb";
import { COMPANY } from "@/lib/company";
import { IMAGES } from "@/lib/images";
import { LANES, ORIGINS } from "@/lib/network";
import {
  AnimatedNumber,
  Reveal,
  Stagger,
  StaggerItem,
} from "@/components/motion/primitives";
import {Container, IconTile, type IconTone, SectionHeading} from "@/components/ui";
import {ClientStrip} from "@/components/Clients";

export const metadata: Metadata = {
  title: "Dropy — Track your order from USA to India",
  description:
    "Track your Dropy order in real time from our USA warehouse to your doorstep in India. Live updates at every stage — packed, shipped, customs cleared, delivered.",
};

const STATS: { value: number; decimals?: number; suffix?: string; label: string }[] = [
  { value: 11400, suffix: "+", label: "Consignments cleared" },
  { value: 98.2, decimals: 1, suffix: "%", label: "Delivered on ETA" },
  { value: 1.4, decimals: 1, suffix: "d", label: "Median customs time" },
  { value: 42, label: "US pickup states" },
  { value: ORIGINS.length, label: "Source markets" },
];

const TRUST: { icon: typeof Plane; label: string; tone: IconTone }[] = [
  { icon: Plane, label: "Air freight, direct", tone: "primary" },
  { icon: Package, label: "Newark & Vashi", tone: "blue" },
  { icon: ShieldCheck, label: "Customs handled", tone: "green" },
];

const TRUST_ICON: Record<string, string> = {
  primary: "text-primary",
  blue: "text-vivid-blue",
  green: "text-vivid-green",
};

/**
 * App home screen — the two things a returning user actually opens Dropy
 * for (track an order, get a quote) as large tap targets, not a marketing
 * scroll. The full brand/product story that used to live here now lives at
 * /about, reachable from BottomNav's About tab or the teaser card below.
 */
export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* A quiet ambient wash, not the full Backdrop (grain + animated
          aurora blobs) — this is a function-first screen, so the glow is
          just enough that the top of the page isn't a flat field. Several
          blurred orbs at different scroll depths, sizes and tones rather
          than one wash at the top — each is cheap on its own (no
          animation, just a static blurred circle), and together they keep
          the long scroll from reading as a flat canvas edge to edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--color-primary)_16%,transparent),transparent_70%)]"
      />
      {/* Spread across the page's actual current length, not its length
          when these were first placed — Coverage (added later) is tall
          enough on its own (an 8-row lane table as mobile cards) that the
          old spread left the entire back half of the page (Reviews
          onward) with no ambient glow at all. */}
      <GlowOrb color="--color-accent" size="size-[20rem]" opacity={14} className="top-10 -right-24" />
      <GlowOrb color="--color-vivid-blue" size="size-[22rem]" opacity={12} className="top-[50rem] -left-28" />
      <GlowOrb color="--color-vivid-violet" size="size-[20rem]" opacity={11} className="top-[95rem] -right-24" />
      <GlowOrb color="--color-vivid-green" size="size-[18rem]" opacity={13} className="top-[150rem] -right-20" />
      <GlowOrb color="--color-vivid-pink" size="size-[24rem]" opacity={11} className="top-[195rem] -left-24" />

      <Container className="relative pt-24 pb-10 md:pt-32 md:pb-16">
        {/*
          A plain inner wrapper, not another Container: nesting two elements
          that both set a Tailwind max-w-* utility risks a specificity tie
          (which one wins depends on generated CSS order, not markup order).
          This keeps the app-width column on desktop without touching
          Container's own max-w-content.
        */}
        <div className="mx-auto w-full max-w-xl">
          {/* ── Header ── */}
          <Reveal>
            <HeroPhotoBanner />

            <p className="mt-4 max-w-sm text-body-sm text-ink-subtle">
              Personal care, beauty, supplements and lifestyle products —
              from five source markets into Mumbai, with a status update
              at every stage.
            </p>
          </Reveal>

          {/* ── Stat row ── */}
          <Reveal delay={0.05}>
            <dl className="mt-6 grid grid-cols-2 gap-3">
              {STATS.map((s, i) => (
                <div
                  key={s.label}
                  // Plain neuro-raised (not neuro-surface): these chips sit
                  // directly on the page canvas, not inside a surface-1
                  // card, so the shadow's light/dark mix should key off
                  // canvas — the same surface it's visually popping out of.
                  // No hover/press classes: these are read-only stats, not
                  // a link or button, so nothing here should look tappable.
                  // Odd item out (5th of 5) spans the full row instead of
                  // leaving a half-empty row at 2 columns.
                  className={`neuro-raised rounded-lg border border-transparent px-3 py-3 text-center ${
                    i === STATS.length - 1 && STATS.length % 2 === 1 ? "col-span-2" : ""
                  }`}
                >
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-display text-[clamp(18px,4vw,22px)] font-semibold tracking-[-0.02em] text-ink">
                    <AnimatedNumber value={s.value} decimals={s.decimals ?? 0} suffix={s.suffix ?? ""} />
                  </dd>
                  <p className="mt-1 text-[11px] leading-tight text-ink-tertiary">{s.label}</p>
                </div>
              ))}
            </dl>
          </Reveal>

          {/* ── Track ── */}
          <Reveal delay={0.1}>
            <section className="gradient-border edge-lift relative mt-6 overflow-hidden rounded-xl border border-hairline bg-surface-1 p-5 shadow-lg sm:p-6">
              <div className="flex items-center gap-3">
                <IconTile icon={Radar} tone="primary" />
                <div>
                  <h2 className="text-body font-medium text-ink">Track an order</h2>
                  <p className="text-caption text-ink-subtle">
                    Tracking ID + registered phone number
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <HeroTrackForm />
              </div>
            </section>
          </Reveal>

          {/* ── Quote ── */}
          <Reveal delay={0.15}>
            <Link
              href="/quote"
              // Brought up to the same weight as the Track card (bg-surface-1,
              // shadow-lg, real border) instead of the flatter bg-surface-2/80
              // treatment it had before — the two are siblings, the primary
              // and secondary action on the screen, and looked mismatched
              // sitting at two different depths.
              className="gradient-border edge-lift group/card mt-4 block overflow-hidden rounded-xl border border-hairline bg-surface-1 p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] sm:p-6"
            >
              <div className="flex items-center gap-3">
                <IconTile icon={Calculator} tone="amber" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-body font-medium text-ink">
                    Get a shipping estimate
                  </h2>
                  <p className="text-caption text-ink-subtle">
                    Origin, weight and category — instant indicative cost
                  </p>
                </div>
                <ChevronRight
                  className="size-5 shrink-0 text-ink-tertiary transition-transform duration-200 group-hover/card:translate-x-0.5"
                  strokeWidth={1.8}
                />
              </div>

              {/* Origin preview — a real taste of the form on /quote
                  (5 source markets), not just a promise in copy. */}
              <div className="mt-4 flex items-center gap-2 border-t border-hairline pt-4">
                <div className="flex -space-x-2">
                  {ORIGINS.map((o) => (
                    <img
                      key={o.country}
                      src={o.flagSrc}
                      alt=""
                      aria-hidden
                      className="size-6 shrink-0 rounded-full object-cover ring-2 ring-surface-1"
                    />
                  ))}
                </div>
                <span className="text-caption text-ink-tertiary">
                  {ORIGINS.length} source markets, one Mumbai gateway
                </span>
              </div>
            </Link>
          </Reveal>

          {/* ── How it works, condensed ── */}
          <Reveal delay={0.2}>
            <HowItMoves />
          </Reveal>

          {/* ── Trust strip — neumorphic sunken pills ── */}
          <Stagger className="mt-8 flex flex-wrap items-center gap-2">
            {TRUST.map(({ icon: Icon, label, tone }) => (
              <StaggerItem key={label}>
                <span className="neuro-raised flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-caption text-ink-subtle">
                  <Icon className={`size-3.5 ${TRUST_ICON[tone]}`} strokeWidth={1.8} />
                  {label}
                </span>
              </StaggerItem>
            ))}
          </Stagger>

          {/* ── Who carries it — a spotlight carousel (name, which leg,
              service tier, why it's booked), not a flat unlabelled logo
              wall. "See all" still earns its keep: /quote#carriers shows
              every carrier across all three legs at once for comparison,
              which a one-at-a-time spotlight deliberately doesn't try to
              replace. ── */}
          <Reveal delay={0.25}>
            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-1.5 text-body font-medium text-ink">
                  <Plane className="size-4 text-ink-tertiary" strokeWidth={1.8} />
                  Who carries it
                </h2>
                <Link
                  href="/quote#carriers"
                  className="inline-flex min-h-9 items-center rounded-md px-1 text-caption text-ink-tertiary transition-colors duration-200 hover:text-ink"
                >
                  See all
                </Link>
              </div>
              <CarrierStrip />
            </div>
          </Reveal>

          {/* ---------------- Client strip ---------------- */}
          <section className="relative overflow-hidden border-t border-hairline pt-14 pb-14 md:pt-20 md:pb-20">
            <GlowOrb color="--color-vivid-violet" size="size-[24rem]" opacity={12} className="top-0 -left-24" />
            <GlowOrb color="--color-vivid-amber" size="size-[20rem]" opacity={11} className="top-10 -right-20" />
            <Container>
              <Reveal>
                <SectionHeading
                    eyebrow="Who we move for"
                    eyebrowIcon={Users}
                    title="India's marketplaces, retailers and distributors."
                    body="Nykaa, Amazon, Flipkart and more ship with us — tap a mark below for what each one moves and where. The full roster is further down the page."
                    align="center"
                />
              </Reveal>
              <div className="mt-10">
                <ClientStrip />
              </div>
            </Container>
          </section>


          {/* ── Coverage — moved from /about, unmodified content, just
              re-styled into Home's compact card idiom (small icon+label
              heading, not the full Eyebrow/serif marketing header) since
              this screen doesn't use the Section/SectionHeading system. ── */}
          <Reveal delay={0.27}>
            <div id="coverage" className="mt-8 scroll-mt-24">
              <h2 className="flex items-center gap-1.5 text-body font-medium text-ink">
                <Compass className="size-4 text-ink-tertiary" strokeWidth={1.8} />
                Coverage
              </h2>
              <p className="mt-1 text-caption text-ink-subtle">
                Live inbound shipments now, full route list below. Air moves
                in about a week, ocean in about six.
              </p>
              <div className="mt-4">
                <NetworkMap lanes={LANES} />
              </div>
              <div className="mt-4">
                <LaneTable />
              </div>
            </div>
          </Reveal>


          {/* ── Reviews ── */}
          <Reveal delay={0.3}>
            <div className="mt-8">
              <ReviewCarousel />
            </div>
          </Reveal>

          {/* ── Live activity ── */}
          <Reveal delay={0.32}>
            <div className="mt-8">
              <LiveFeed />
            </div>
          </Reveal>

          {/* ── About teaser — photo banner ── */}
          <Reveal delay={0.35}>
            <Link
              href="/about"
              className="group/about gradient-border edge-lift relative mt-6 block overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99]"
            >
              <div className="relative h-28 overflow-hidden">
                <Image
                  src={IMAGES.distributionFloor.src}
                  alt=""
                  aria-hidden
                  fill
                  sizes="(max-width: 480px) 100vw, 480px"
                  className="photo object-cover transition-transform duration-[1.2s] ease-out group-hover/about:scale-[1.06]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/30 to-transparent" />
              </div>
              <div className="relative -mt-8 flex items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-ink">
                    How Dropy works
                  </span>
                  <span className="mt-0.5 block text-caption text-ink-subtle">
                    Origins, carriers, Mumbai clearance, and what's included
                  </span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-ink-tertiary transition-transform duration-200 group-hover/about:translate-x-0.5"
                  strokeWidth={1.8}
                />
              </div>
            </Link>
          </Reveal>

          {/* ── FAQ ── */}
          <Reveal delay={0.38}>
            <div id="faq" className="mt-6 scroll-mt-24">
              <FAQAccordion />
            </div>
          </Reveal>

          {/* ── Need help ── */}
          <Reveal delay={0.4}>
            <div className="mt-6 flex items-center justify-center gap-2">
              <a
                href={`mailto:${COMPANY.email}`}
                className="neuro-raised flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-transparent px-3 text-caption text-ink-subtle transition-transform duration-200 active:scale-95"
              >
                <Mail className="size-3.5 text-ink-tertiary" strokeWidth={1.8} />
                Email support
              </a>
              <a
                href={COMPANY.phoneHref}
                className="neuro-raised flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-transparent px-3 text-caption text-ink-subtle transition-transform duration-200 active:scale-95"
              >
                <Phone className="size-3.5 text-ink-tertiary" strokeWidth={1.8} />
                Call us
              </a>
            </div>
          </Reveal>
        </div>
      </Container>
    </div>
  );
}
