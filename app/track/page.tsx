import { Suspense } from "react";
import type { Metadata } from "next";
import { Plane } from "lucide-react";
import FAQAccordion from "@/components/FAQAccordion";
import TrackClient from "@/components/TrackClient";
import TransportModes from "@/components/TransportModes";
import GlowOrb from "@/components/fx/GlowOrb";
import { Container, Section, SectionHeading } from "@/components/ui";
import { Reveal } from "@/components/motion/primitives";
import { isSupabaseConfigured } from "@/lib/supabase";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: `Track your order — ${COMPANY.legalName}`,
  description:
    `Enter your ${COMPANY.legalName} tracking ID and registered phone number to see the live status of your US-to-India order.`,
  alternates: { canonical: "/track" },
};

export const dynamic = "force-dynamic";

export default function TrackPage() {
  // Nothing is listed up front. A visitor sees only the consignment whose
  // identifier they already hold — see components/TrackClient.tsx.
  //
  // No full Backdrop (grain + animated aurora) — this is a function-first
  // screen — but a flat canvas behind a bare heading read as unfinished, so
  // a static, non-animated glow gives the header some depth at near-zero cost.
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--color-primary)_14%,transparent),transparent_70%)]"
      />
      <GlowOrb color="--color-vivid-blue" size="size-[22rem]" opacity={13} className="top-[38rem] -right-24" />
      <GlowOrb color="--color-accent" size="size-[20rem]" opacity={12} className="top-[64rem] -left-20" />

      <Container className="relative pt-24 pb-16 md:pt-32 md:pb-24">
        <Reveal>
          <div className="flex flex-col items-start gap-2">
            <h1 className="max-w-2xl font-display text-[clamp(24px,4vw,36px)] leading-[1.1] font-semibold tracking-[-0.03em] text-ink text-balance">
              Track your order
            </h1>
            <p className="max-w-xl text-body-sm text-ink-subtle">
              Enter your tracking ID and registered phone number.
            </p>
          </div>
        </Reveal>

        <div className="mt-7">
          <Suspense
            fallback={
              <div className="h-16 rounded-xl border border-hairline bg-surface-1" />
            }
          >
            <TrackClient isDemo={!isSupabaseConfigured} />
          </Suspense>
        </div>
      </Container>

      {/* ---------------- How it moves ---------------- */}
      {/* Moved from /about, unmodified. */}
      <Section id="modes" tone="raised">
        <Reveal>
          <SectionHeading
            eyebrow="How it moves"
            eyebrowIcon={Plane}
            title="Air, ocean, and the road at both ends."
            body="Most orders split across two of these. We book whichever gets your stock on the rack in time, and the console shows the same record either way."
          />
        </Reveal>
        <div className="mt-12">
          <TransportModes />
        </div>
      </Section>

      <Container>
        <Reveal delay={0.1}>
          <div id="faq" className="mt-12 scroll-mt-24 pb-16 md:pb-24">
            <FAQAccordion />
          </div>
        </Reveal>
      </Container>
    </div>
  );
}
