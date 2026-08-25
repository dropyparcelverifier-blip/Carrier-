import { Suspense } from "react";
import type { Metadata } from "next";
import { Handshake, Route } from "lucide-react";
import Carriers from "@/components/Carriers";
import CustomsScreenshot from "@/components/CustomsScreenshot";
import FAQAccordion, { QUOTE_FAQS } from "@/components/FAQAccordion";
import ProcessSection from "@/components/ProcessSection";
import QuoteClient from "@/components/QuoteClient";
import Backdrop from "@/components/fx/Backdrop";
import GlowOrb from "@/components/fx/GlowOrb";
import { COMPANY } from "@/lib/company";
import { PerspectivePanel } from "@/components/motion/gsap-scenes";
import { Reveal } from "@/components/motion/primitives";
import {
  Container,
  ProductPanel,
  Section,
  SectionHeading,
} from "@/components/ui";

export const metadata: Metadata = {
  title: `Get an estimate — ${COMPANY.legalName}`,
  description:
      "Select an origin market and enter the weight and category to get an indicative freight estimate.",
  alternates: { canonical: "/quote" },
};

export const dynamic = "force-dynamic";

export default function QuotePage() {
  // Function-first screen, same as /track — a compact screen title instead
  // of the marketing-hero header, no full decorative Backdrop, just a
  // static ambient glow so the header isn't a flat field.
  return (
      <div className="relative overflow-hidden">
        <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--color-accent)_14%,transparent),transparent_70%)]"
        />
        {/* Orbs are positioned at fixed rem offsets tuned for the desktop
          flow — on mobile the same offsets land in arbitrary places, so
          they only render from md up. */}
        <div aria-hidden className="hidden md:block">
          <GlowOrb color="--color-vivid-violet" size="size-[20rem]" opacity={13} className="top-[20rem] -left-24" />
          <GlowOrb color="--color-vivid-pink" size="size-[22rem]" opacity={12} className="top-[68rem] -right-24" />
        </div>

        <Container className="relative pt-20 pb-12 md:pt-28 md:pb-20">
          <Reveal>
            <div className="flex flex-col items-start gap-2">
              <h1 className="max-w-2xl font-display text-[clamp(28px,5vw,40px)] leading-[1.05] font-semibold tracking-[-0.03em] text-ink text-balance">
                Get an estimate
              </h1>
              <p className="max-w-xl text-body-sm text-ink-subtle">
                Origin, weight and category — an indicative freight cost and
                transit window, not a locked quote.
              </p>
            </div>
          </Reveal>

          {/* Fallback height tracks the real card so hydration doesn't shove
            the whole page down. scroll-mt keeps the #quote anchor clear of
            the sticky header pill on mobile. */}
          <div id="quote" className="mt-7 scroll-mt-24 md:scroll-mt-28">
            <Suspense
                fallback={
                  <div className="min-h-[30rem] rounded-2xl border border-hairline bg-surface-1 md:min-h-[34rem]" />
                }
            >
              <QuoteClient />
            </Suspense>
          </div>
        </Container>

        {/* ---------------- How it works ---------------- */}
        {/* Moved from /about, unmodified. Sits ahead of "Who carries it"
          now — the general process reads better before the specific
          carrier-by-leg detail, not after it. */}
        <Section
            id="how-it-works"
            className="overflow-hidden scroll-mt-20 md:scroll-mt-24"
        >
          <Backdrop variant="soft" className="opacity-70" />
          <Reveal>
            <SectionHeading
                eyebrow="How it works"
                eyebrowIcon={Route}
                title="From an overseas supplier to your rack, in four moves."
                body="Your team places the order. Everything after that is ours, and all of it lands on one record you can open."
            />
          </Reveal>
          <div className="mt-12">
            <ProcessSection />
          </div>

          <div className="mt-6">
            <PerspectivePanel>
              <ProductPanel>
                <CustomsScreenshot />
              </ProductPanel>
            </PerspectivePanel>
          </div>
        </Section>

        {/* ---------------- Who carries it ---------------- */}
        {/* Also moved from /about, unmodified. */}
        <Section
            id="carriers"
            tone="raised"
            className="scroll-mt-20 md:scroll-mt-24"
        >
          <Reveal>
            <SectionHeading
                eyebrow="Who carries it"
                eyebrowIcon={Handshake}
                title="The operators we book."
                body="We are the forwarder and the broker, not the airline. These are the carriers your cargo actually moves on, by leg."
            />
          </Reveal>
          <div className="mt-12">
            <Carriers />
          </div>
        </Section>

        <Container>
          <Reveal delay={0.1}>
            <div id="faq" className="mt-12 scroll-mt-24 pb-16 md:pb-24">
              <FAQAccordion items={QUOTE_FAQS} />
            </div>
          </Reveal>
        </Container>
      </div>
  );
}