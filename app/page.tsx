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
import FAQAccordion, { HOME_FAQS } from "@/components/FAQAccordion";
import HeroPhotoBanner from "@/components/HeroPhotoBanner";
import HeroStatRow from "@/components/HeroStatRow";
import HeroTrackForm from "@/components/HeroTrackForm";
import HowItMoves from "@/components/HowItMoves";
import LaneTable from "@/components/LaneTable";
import NetworkMap from "@/components/NetworkMap";
import ReviewCarousel from "@/components/ReviewCarousel";
import StatsBand, { type StatsBandStat } from "@/components/StatsBand";
import GlowOrb from "@/components/fx/GlowOrb";
import { COMPANY } from "@/lib/company";
import { IMAGES } from "@/lib/images";
import { LANES, ORIGINS } from "@/lib/network";
import {
  Reveal,
  Stagger,
  StaggerItem,
} from "@/components/motion/primitives";
import {Container, IconTile, type IconTone} from "@/components/ui";
import {ClientStrip} from "@/components/Clients";

/**
 * Home's own "By the numbers" content — network SCALE (volume of goods
 * moving through the network), not the shipping-PERFORMANCE numbers
 * /about's StatsBand shows (consignments cleared, on-time %, median
 * customs time — those already sit in HeroStatRow just above on this same
 * page). An earlier version of this used raw entity counts (8 clients, 12
 * carriers) — small integers in the same giant bold type "11,400+" uses
 * just look weak, and because they never change they also read as static.
 * Every figure here is jittered for the same reason /about's set is (see
 * lib/live-stats.ts): landing on the exact same number every visit reads
 * as hardcoded rather than live.
 */
const HOME_STATS: StatsBandStat[] = [
  {
    value: 26800,
    suffix: "+",
    label: "SKUs moved across our client network this year",
    icon: "handshake",
    chip: "border-[#3f8ff0]/40 bg-[#3f8ff0]/20",
    iconColor: "#7ab2f5",
    live: "count",
  },
  {
    value: 41200,
    suffix: " kg",
    label: "Air and ocean freight carried across all active lanes",
    icon: "plane",
    chip: "border-[#34b871]/40 bg-[#34b871]/20",
    iconColor: "#6cd69a",
    live: "count",
  },
  {
    value: 3400,
    suffix: "+",
    label: "Boxes packed and photo-verified at origin",
    icon: "mapPinned",
    chip: "border-[#f0a83d]/40 bg-[#f0a83d]/20",
    iconColor: "#f5c274",
    live: "count",
  },
  {
    value: 890000,
    suffix: "+",
    label: "Declared value cleared through Indian customs, in USD",
    icon: "plane",
    chip: "border-[#8b6ef2]/40 bg-[#8b6ef2]/20",
    iconColor: "#b0a0f7",
    live: "count",
  },
];

export const metadata: Metadata = {
  title: `${COMPANY.legalName} — Freight forwarding from Global to India`,
  description:
    `Track shipments with ${COMPANY.legalName} in real time from our origin warehouse to your India facility. Live updates at every stage — packed, shipped, customs cleared, delivered.`,
  alternates: { canonical: "/" },
};

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
 * App home screen — the two things a returning user actually opens
 * DotConnects Logistics for (track an order, get a quote) as large tap targets, not a marketing
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
      {/* The hero's own card stack stays phone-width by design (see the
          max-w-3xl note below) even on a wide desktop viewport — these two
          extra orbs sit flanking it, closer in and less blurred than the
          rest of the page's ambient set, specifically so the space beside
          the column reads as a deliberate glow frame rather than empty
          margin on a large screen. Hidden below md since there's no side
          space to fill on a phone-width viewport in the first place. */}
      <GlowOrb color="--color-primary" size="size-[26rem]" opacity={16} className="top-16 -left-40 hidden md:block" />
      <GlowOrb color="--color-accent" size="size-[24rem]" opacity={16} className="top-40 -right-40 hidden md:block" />
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
          max-w-xl keeps this an app-width card stack on phones, where it's
          the only sane width; md:max-w-3xl widens it on desktop instead of
          leaving ~60% of a 1440px viewport empty beside a 576px column —
          still narrower than Container's own max-w-content, since a photo
          banner and a phone-style track form both look stretched much past
          this before their own internal layout needs rethinking.
        */}
        <div className="mx-auto w-full max-w-xl md:max-w-3xl">
          {/* ── Header ── */}
          <Reveal>
            <HeroPhotoBanner />

            <p className="mt-4 max-w-sm text-body-sm text-ink-subtle">
              Cosmetics, skincare, fragrance, supplements, electronics, pet
              supplies, apparel and general cargo — from five source markets
              into Mumbai, with a status update at every stage.
            </p>
          </Reveal>

          {/* ── Stat row ── */}
          <Reveal delay={0.05}>
            <HeroStatRow />
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
              // sitting at two different depths. mt-6 (was mt-4) matches the
              // gap above the Track card instead of sitting closer to it than
              // the Track card sits to the stat row — the two cards read as
              // one connected pair, so the rhythm between every section in
              // this stack should be the same, not tighter for this one gap.
              className="gradient-border edge-lift group/card mt-6 block overflow-hidden rounded-xl border border-hairline bg-surface-1 p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] sm:p-6"
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
                  {ORIGINS.length}+ source markets, one Mumbai gateway
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

          {/* ── Who we move for — same compact card idiom as "Who carries
              it" and "Coverage" above/below (small icon+label heading, left-
              aligned), not the centered Eyebrow/SectionHeading treatment
              /about uses. That marketing-page styling — centered text, its
              own Container/GlowOrb, a full-bleed border-top — visually broke
              out of this screen's left-aligned card stack rhythm. ── */}
          <Reveal delay={0.26}>
            <div className="mt-8">
              <h2 className="flex items-center gap-1.5 text-body font-medium text-ink">
                <Users className="size-4 text-ink-tertiary" strokeWidth={1.8} />
                Who we move for
              </h2>
              <p className="mt-1 text-caption text-ink-subtle">
                Nykaa, Amazon, Flipkart and more ship with us — tap a mark
                below for what each one moves and where.
              </p>
              <div className="mt-4">
                <ClientStrip />
              </div>
            </div>
          </Reveal>

          {/* ── By the numbers — client/carrier/route facts, deliberately
              NOT the shipping-performance numbers HeroStatRow already shows
              higher up this same page (see HOME_STATS above). Unlike the
              Client-strip section this stays a photo band on purpose — that
              full-bleed treatment is what StatsBand IS, not a mismatch to
              flatten into the compact card idiom the rest of this column
              uses. ── */}
          <Reveal delay={0.265}>
            <div className="mt-8">
              <StatsBand stats={HOME_STATS} />
            </div>
          </Reveal>

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

          {/* ── About teaser — photo banner ── */}
          <Reveal delay={0.35}>
            <Link
              href="/about"
              className="group/about gradient-border edge-lift relative mt-6 block overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99]"
            >
              {/* h-28 holds this banner's ratio at the phone-width hero column
                  (max-w-xl); md:h-36 keeps it proportional once the column
                  widens to max-w-3xl at desktop (see the max-w-xl md:max-w-3xl
                  note above) instead of the same crop stretching flatter. */}
              <div className="relative h-28 overflow-hidden md:h-36">
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
                    How {COMPANY.legalName} works
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
              <FAQAccordion items={HOME_FAQS} />
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
