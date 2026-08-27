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
  ShieldCheck,
} from "lucide-react";
import CarrierStrip from "@/components/CarrierStrip";
import FAQAccordion, { HOME_FAQS } from "@/components/FAQAccordion";
import HeroPhotoBanner from "@/components/HeroPhotoBanner";
import HeroStatRow from "@/components/HeroStatRow";
import HowItMoves from "@/components/HowItMoves";
import LaneTable from "@/components/LaneTable";
import NetworkMap from "@/components/NetworkMap";
import Outcomes from "@/components/Outcomes";
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
import Services from "@/components/Services";
import { TRACKING_ORIGIN } from "@/lib/tracking-site";
import PageSection from "@/components/PageSection";

/**
 * Home's own "By the numbers" content — network SCALE (volume of goods
 * moving through the network), not the shipping-PERFORMANCE numbers
 * /about's StatsBand shows (consignments cleared, on-time %, median
 * customs time — those already sit in HeroStatRow just above on this same
 * page).
 */
/**
 * The four figures here were invented — "26,800+ SKUs moved", "41,200 kg
 * freight carried", "3,400 boxes packed", "$890,000 declared value
 * cleared" — and three were randomised per visit so they wouldn't look
 * hardcoded.
 *
 * Replaced with what the network structurally IS. Every value is derived
 * from lib/network.ts, so it can't contradict the lane table further down
 * the page and it holds up if a prospect asks.
 *
 * When there are real numbers worth showing, they belong here — but they
 * should come from the database, not from a constant.
 */
const HOME_STATS: StatsBandStat[] = [
  {
    value: ORIGINS.length,
    label: "Origin markets in the network",
    icon: "handshake",
    chip: "border-[#3f8ff0]/40 bg-[#3f8ff0]/20",
    iconColor: "#7ab2f5",
  },
  {
    value: LANES.filter((l) => l.mode === "air").length,
    label: "Direct air lanes running",
    icon: "plane",
    chip: "border-[#34b871]/40 bg-[#34b871]/20",
    iconColor: "#6cd69a",
  },
  {
    value: 2,
    label: "Own warehouses at origin and destination",
    icon: "warehouse",
    chip: "border-[#e0a04a]/40 bg-[#e0a04a]/20",
    iconColor: "#f0c07a",
  },
  {
    value: 1,
    suffix: " carton",
    label: "Minimum consignment — no floor that turns small clients away",
    icon: "packageCheck",
    chip: "border-[#a06cf5]/40 bg-[#a06cf5]/20",
    iconColor: "#c39cf8",
  },
];


export const metadata: Metadata = {
  title: `${COMPANY.legalName} — Freight forwarding from Global to India`,
  description:
    `Track shipments with ${COMPANY.legalName} in real time from our origin warehouse to your India facility. Live updates at every stage — packed, shipped, customs cleared, delivered.`,
  alternates: { canonical: "/" },
};

/**
 * Six, not ten. Ten chips is a wall and the eye stops reading at about
 * five — each extra one dilutes the rest.
 *
 * No place names. "Newark & Vashi" made a five-market network sound like
 * a two-warehouse operation.
 */
const TRUST: { icon: typeof Plane; label: string; tone: IconTone }[] = [
  { icon: Compass, label: "Five origin markets", tone: "primary" },
  { icon: Plane, label: "Daily departures", tone: "blue" },
  { icon: Package, label: "One carton minimum", tone: "amber" },
  { icon: Plane, label: "Air, ocean and road", tone: "cyan" },
  { icon: ShieldCheck, label: "Customs included", tone: "green" },
  { icon: Calculator, label: "Landed cost quoted upfront", tone: "violet" },
];

const TRUST_ICON: Record<string, string> = {
  primary: "text-primary",
  blue: "text-vivid-blue",
  green: "text-vivid-green",
};

/**
 * App home screen — the two things a returning user actually opens
 * DotConnects Logistics for (track an order, get a quote) as large tap
 * targets, not a marketing scroll. The full brand/product story that used
 * to live here now lives at /about, reachable from BottomNav's About tab
 * or the teaser card below.
 *
 * LAYOUT: every section below is a <PageSection>, without exception. The
 * previous revision converted four of thirteen and left the other nine on
 * the old `mt-10 border-t pt-8` idiom — two spacing systems roughly 3.5x
 * apart inside one column, which reads as holes in the page rather than
 * as rhythm. Mixing them is what broke this page; there is no correct
 * subset to convert. If a new section is added here it is a PageSection
 * too.
 *
 * Sections used to alternate between a 58% left and a 58% right column,
 * sized so a scroll-linked aircraft could fly up the clear side. The
 * aircraft is gone; an offset with an empty gap is just 430px of dead
 * margin, so every section is full width now.
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
          when these were first placed — the section rhythm changed with
          the PageSection conversion, and the old offsets left the whole
          back half of the page (Coverage onward) with no ambient glow at
          all. Re-derived from the measured document height; if the page
          grows another section, re-space them again. */}
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
      <GlowOrb color="--color-vivid-blue" size="size-[22rem]" opacity={12} className="top-[62rem] -left-28" />
      <GlowOrb color="--color-vivid-violet" size="size-[20rem]" opacity={11} className="top-[162rem] -right-24" />
      <GlowOrb color="--color-vivid-green" size="size-[18rem]" opacity={13} className="top-[268rem] -right-20" />
      <GlowOrb color="--color-vivid-pink" size="size-[24rem]" opacity={11} className="top-[374rem] -left-24" />

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

          Every PageSection below sits INSIDE this wrapper, so this column
          is the width their container queries measure — 1024px at lg+,
          704 at md, 350 on a phone. Moving a section out of here changes
          those numbers and has to be checked on screen, not just built.
        */}
        {/* home-cards: scopes globals.css's mobile-only softening of the
            gradient-border glow / edge-lift highlight / heavy shadow-lg
            combo every card here uses — see that rule's own comment for
            why. TopNav/BottomNav render outside this wrapper (in
            layout.tsx), so they keep the full effect regardless of
            viewport, as intended. */}
        <div className="home-cards mx-auto w-full max-w-xl md:max-w-3xl lg:max-w-5xl">
          {/* ── Hero + primary actions ──
              Full width: this is the establishing shot, and it already
              splits into its own two columns at lg. reveal={false} — the
              cards inside stage their own Reveals with delays, and
              wrapping the lot in one more would fade the group in and then
              animate it again inside.

              Below lg this is the original single narrow stack (photo,
              subhead, stats, then Track/Quote below) — untouched. At lg+
              it splits into two columns instead: the photo/headline/
              subhead/stats stay left at their original width, and
              Track+Quote — the two actions this whole screen exists for —
              move into a right-hand column so they sit beside the hero
              instead of trailing beneath a lot of empty page width. */}
          <PageSection leg="hero" space="hero" reveal={false}>
            <div className="lg:grid lg:grid-cols-[5fr_4fr] lg:items-stretch lg:gap-8">
              <div className="lg:flex lg:flex-col">
                <Reveal>
                  <HeroPhotoBanner />

                  <p className="mt-4 max-w-sm text-body-sm text-ink-subtle">
                    From a single carton to a full pallet. Daily essentials,
                    personal care, apparel, electronics and general goods — moved
                    on a schedule, with a status update at every stage.
                  </p>
                </Reveal>

                {/* ── Stat row ──
                    lg:mt-auto lets this settle at the bottom of whatever
                    height the row ends up (matched to the taller right
                    column via items-stretch above), instead of the two
                    columns ending at different heights with a gap of dead
                    space under the shorter one before the next section. */}
                <Reveal delay={0.05} className="lg:mt-auto lg:pt-6">
                  <HeroStatRow />
                </Reveal>
              </div>

              <div>
                {/*
                    The "Price a movement" card was removed — it and the
                    quote card below offered the same action twice, one
                    directly under the other. The remaining card carries
                    both the quote CTA and the track line.
                */}
                {/* ── Quote ── */}
                <Reveal delay={0.15}>
                  <Link
                    href="/quote"
                    // Brought up to the same weight as the card above
                    // (bg-surface-1, shadow-lg, real border) instead of the
                    // flatter bg-surface-2/80 treatment it had before — the
                    // two are siblings, the primary and secondary action on
                    // the screen, and looked mismatched sitting at two
                    // different depths. mt-6 matches the gap above rather
                    // than sitting closer to it than that card sits to the
                    // stat row.
                    className="gradient-border edge-lift group/card mt-6 block overflow-hidden rounded-xl border border-hairline bg-surface-1 p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] sm:p-6"
                  >
                    <div className="flex items-center gap-3">
                      <IconTile icon={Calculator} tone="amber" />
                      <div className="min-w-0 flex-1">
                        <h2 className="text-body font-medium text-ink">
                          Moving stock regularly?
                        </h2>
                        <p className="text-caption text-ink-subtle">
                          Standing lanes and contract rates
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
                        {ORIGINS.length} origin markets · air and ocean
                      </span>
                    </div>
                  </Link>
                </Reveal>

                {/* ── Trust card — desktop only, fills the right column's
                    remaining height next to the two action cards instead of
                    leaving it short next to the taller left column. Same
                    COMPANY data the site footer already surfaces, not new
                    copy. */}
                <div className="mt-6 hidden rounded-xl border border-hairline bg-surface-1 p-5 shadow-sm lg:block">
                  <p className="text-caption font-medium text-ink-tertiary uppercase tracking-wide">Why ship with us</p>
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {COMPANY.credentials.map((c) => (
                      <li key={c.label} className="flex items-center gap-2 text-body-sm text-ink-subtle">
                        <ShieldCheck className="size-3.5 shrink-0 text-vivid-green" strokeWidth={1.8} />
                        {c.label}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`mailto:${COMPANY.email}`}
                    className="mt-4 inline-flex items-center gap-1.5 text-caption font-medium text-primary hover:text-primary-hover hover:underline"
                  >
                    <Mail className="size-3.5" strokeWidth={1.8} />
                    {COMPANY.email}
                  </a>
                  <p className="mt-4 border-t border-hairline pt-4 text-caption text-ink-tertiary">
                    Shipping with us already?{" "}
                    <a
                      href={TRACKING_ORIGIN}
                      className="font-medium text-primary transition-colors hover:text-primary-hover"
                    >
                      Track a consignment
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </PageSection>

          {/*
              WHAT we move comes before HOW it moves. A freight buyer's
              first question is whether we handle their kind of movement;
              the process only matters once that's answered. The site had
              no section answering it at all.

              The card grid picks its column count from a container query
              on the section body, not a viewport breakpoint: 3-up at the
              full 1024px column, 2-up at tablet width, stacked on a phone.
          */}
          <PageSection leg="services" space="lg" rule>
            <Services />
          </PageSection>

          <PageSection leg="how" space="lg">
            <HowItMoves />
          </PageSection>

          {/* ── Trust strip — neumorphic sunken pills ──
              reveal={false}: Stagger animates its own children in. */}
          <PageSection leg="trust" space="sm" reveal={false}>
            <Stagger className="flex flex-wrap items-center gap-2">
              {TRUST.map(({ icon: Icon, label, tone }) => (
                <StaggerItem key={label}>
                  <span className="neuro-raised flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-caption text-ink-subtle">
                    <Icon className={`size-3.5 ${TRUST_ICON[tone]}`} strokeWidth={1.8} />
                    {label}
                  </span>
                </StaggerItem>
              ))}
            </Stagger>
          </PageSection>

          {/* ── Who carries it — a spotlight carousel (name, which leg,
              service tier, why it's booked), not a flat unlabelled logo
              wall. "See all" still earns its keep: /quote#carriers shows
              every carrier across all three legs at once for comparison,
              which a one-at-a-time spotlight deliberately doesn't try to
              replace.

              ONE strip, not two. The previous revision replaced the
              "Who we move for" ClientStrip with a CarrierStrip while
              leaving this section — already a CarrierStrip — directly
              above it, so the page rendered the identical carousel twice
              back to back under two different headings. The reason that
              swap happened is worth keeping, though, so the honest copy
              from it lives here now:

              "Who we move for" read "Nykaa, Amazon, Flipkart and more ship
              with us" over a client logo strip. Those parcels move through
              the CARRIERS we book, not through us — the claim was false,
              and a prospect asking "tell us about the Amazon account"
              would have found that out immediately. The carrier network is
              the true version of the same point, and it reads bigger.
              These are real booked relationships. ── */}
          <PageSection leg="carriers" space="md">
            {/* Its own card, matching How it moves above. These two sit
                back to back; one carded and one loose read as a mistake
                rather than a rhythm. */}
            <div className="edge-lift rounded-xxl border border-hairline bg-surface-1 p-6 shadow-lg md:p-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-1.5 text-body font-medium text-ink">
                <Plane className="size-4 text-vivid-blue" strokeWidth={1.8} />
                Who carries it
              </h2>
              <Link
                href="/quote#carriers"
                className="inline-flex min-h-9 items-center rounded-md px-1 text-caption text-ink-tertiary transition-colors duration-200 hover:text-ink"
              >
                See all
              </Link>
            </div>
            <p className="mb-4 -mt-2 text-caption text-ink-subtle">
              The same airlines, shipping lines and last-mile carriers that
              move consignments for the largest importers in the country
              move yours.
            </p>
            <CarrierStrip wide />
            </div>
          </PageSection>

          {/* ── By the numbers — client/carrier/route facts, deliberately
              NOT the shipping-performance numbers HeroStatRow already shows
              higher up this same page (see HOME_STATS above). Full width on
              purpose — that full-bleed treatment is what StatsBand IS, not
              a mismatch to flatten into the compact card idiom the rest of
              this column uses, and it is one of the two sections the rules
              call out as needing the whole width. ── */}
          <PageSection leg="numbers" space="md">
            {/* A thin gradient thread, not a hard jump from a white
                card stack straight into a dark full-bleed photo band —
                the same 4 vivid colors HOME_STATS' own chips use
                inside StatsBand, so the band reads as connected to
                the page around it instead of an unrelated banner
                dropped in. */}
            <div
                aria-hidden
                className="mb-4 h-px w-full rounded-full opacity-60"
                style={{ background: "linear-gradient(90deg, #3f8ff0, #34b871, #f0a83d, #8b6ef2)" }}
            />
            <StatsBand stats={HOME_STATS} />
          </PageSection>

          {/* ── Coverage — moved from /about, unmodified content, just
              re-styled into Home's compact card idiom (small icon+label
              heading, not the full Eyebrow/serif marketing header) since
              this screen doesn't use the Section/SectionHeading system.

              The one section on `xl` spacing: the map is the payoff of
              the whole page and earns more room around it than anything
              else here. ── */}
          <PageSection
            id="coverage"
            leg="coverage"
            space="xl"
            rule
            className="scroll-mt-24"
          >
            <h2 className="flex items-center gap-1.5 text-body font-medium text-ink">
              <Compass className="size-4 text-vivid-cyan" strokeWidth={1.8} />
              Coverage
            </h2>
            <p className="mt-1 text-caption text-ink-subtle">
              Live inbound shipments now, full route list below. Air moves
              in about a week, ocean in about six.
            </p>
            <div className="mt-6">
              <NetworkMap lanes={LANES} />
            </div>
            <div className="mt-6">
              <LaneTable />
            </div>
          </PageSection>

          {/* ── Outcomes — three measured figures, 3-up at the full
              column and stacked below @2xl, on its own container query. ── */}
          <PageSection leg="outcomes" space="lg" rule>
            <Outcomes />
          </PageSection>

          {/* ── About teaser — photo banner ──
              Real weight now, not a thin cramped strip — this is the
              one link off Home into the actual brand/product story, so
              it earns a genuine hero-scale treatment (taller image,
              bigger heading) instead of reading like an afterthought
              squeezed in before the footer. `sizes` matches this column's
              REAL widths at each breakpoint (xl/md/lg max-w on the page's
              own outer wrapper) — it was locked to `480px` from before the
              column widened at lg:, so Next.js was serving a lower-res
              image than the banner actually renders at, which read soft on
              a big screen. */}
          <PageSection leg="about" space="md">
            <Link
              href="/about"
              className="group/about gradient-border edge-lift relative block overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99]"
            >
              <div className="relative h-40 overflow-hidden sm:h-48 md:h-56 lg:h-64">
                <Image
                  src={IMAGES.distributionFloor.src}
                  alt=""
                  aria-hidden
                  fill
                  sizes="(max-width: 639px) 100vw, (max-width: 767px) 576px, (max-width: 1023px) 768px, 1024px"
                  className="photo object-cover transition-transform duration-[1.2s] ease-out group-hover/about:scale-[1.06]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-surface-1/40 to-transparent" />
              </div>
              <div className="relative -mt-14 flex items-end justify-between gap-4 p-5 sm:p-6 lg:p-8">
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-card-title font-semibold text-ink lg:text-headline">
                    How {COMPANY.legalName} works
                  </span>
                  <span className="mt-1 block text-body-sm text-ink-subtle">
                    Origins, carriers, customs clearance, and what's included
                  </span>
                </span>
                <span className="neuro-raised flex size-11 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-all duration-200 group-hover/about:translate-x-0.5 group-hover/about:text-ink lg:size-12">
                  <ArrowRight className="size-4 lg:size-5" strokeWidth={1.8} />
                </span>
              </div>
            </Link>
          </PageSection>

          {/* ── FAQ ── */}
          <PageSection
            id="faq"
            leg="faq"
            space="lg"
            rule
            className="scroll-mt-24"
          >
            <FAQAccordion items={HOME_FAQS} flat />
          </PageSection>

          {/* ── Closing CTA ──
              The page used to just trail off after FAQ into two small
              neutral pill buttons — no real ending moment before the
              site footer. This gives it one: a genuine headline, the
              primary "Get a quote" action restated one last time (the
              whole point of this screen), and the same two contact
              links, now secondary to that rather than the only thing
              here. Tinted with the brand primary, not another flat
              white card — the one deliberately colored surface on the
              page's home stretch, so it reads as a closing beat, not
              one more identical section. */}
          <PageSection leg="cta" space="md">
            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-surface-1 p-6 text-center sm:p-8">
              <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14]"
                  style={{ background: "radial-gradient(60% 80% at 50% 0%, var(--color-primary), transparent 70%)" }}
              />
              <h2 className="font-display text-card-title font-semibold text-ink">
                Ready to move your next consignment?
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-body-sm text-ink-subtle">
                Get an indicative rate in seconds, or talk to us about a standing lane.
              </p>
              <div className="mt-5 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <Link
                  href="/quote"
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-body-sm font-medium text-on-primary shadow-glow transition-transform duration-200 hover:bg-primary-hover active:scale-95 sm:w-auto"
                >
                  <Calculator className="size-3.5" strokeWidth={1.8} />
                  Get a quote
                </Link>
                <div className="flex w-full items-center justify-center gap-2 sm:w-auto">
                  <a
                    href={`mailto:${COMPANY.email}`}
                    className="neuro-raised flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-transparent px-3 text-caption text-ink-subtle transition-transform duration-200 active:scale-95 sm:flex-none"
                  >
                    <Mail className="size-3.5 text-ink-tertiary" strokeWidth={1.8} />
                    Email support
                  </a>
                  <a
                    href={COMPANY.phoneHref}
                    className="neuro-raised flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-transparent px-3 text-caption text-ink-subtle transition-transform duration-200 active:scale-95 sm:flex-none"
                  >
                    <Phone className="size-3.5 text-ink-tertiary" strokeWidth={1.8} />
                    Call us
                  </a>
                </div>
              </div>
            </div>
          </PageSection>
        </div>
      </Container>
    </div>
  );
}
