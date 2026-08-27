import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  CheckCircle2,
  Clock4,
  Globe2,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import BentoFeatures from "@/components/BentoFeatures";
import { COMPANY } from "@/lib/company";
import Origins from "@/components/Origins";
import Clearance from "@/components/Clearance";
import Limits from "@/components/Limits";
import StatsBand from "@/components/StatsBand";
import { ClientGrid, ClientStrip } from "@/components/Clients";
import GlowOrb from "@/components/fx/GlowOrb";
import { IMAGES } from "@/lib/images";
import { Magnetic, Reveal } from "@/components/motion/primitives";
import CarrierStrip from "@/components/CarrierStrip";
import {
  ButtonLink,
  Container,
  Eyebrow,
  Section,
  SectionHeading,
} from "@/components/ui";

export const metadata: Metadata = {
  title: `About ${COMPANY.legalName} — how the global-to-India pipeline works`,
  description:
    `Where ${COMPANY.legalName} onboards stock across five source markets, who carries it, how Mumbai clearance works, and what's included — the full story behind the tracking experience.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <div className="relative overflow-hidden">
        {/* Background photo, not the animated aurora Backdrop — stacking a
            full-bleed photo AND two blurred aurora blobs AND grain on the
            same section is a lot of simultaneous blur/compositing for one
            hero (real cost on scroll, and visually busy), and the photo
            already gives this hero depth on its own. Same contrast-safety
            rule as the Home hero photo: the gradient stays canvas-opaque
            everywhere the H1/paragraph/credentials sit, and only lets the
            photo show through at the very top edge and sides, so text
            legibility never depends on tuning a scrim against an arbitrary
            image. */}
        <div aria-hidden className="absolute inset-0 -z-20">
          <Image
            src={IMAGES.containerPort.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className="photo object-cover"
          />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-b from-canvas/30 from-0% via-canvas/90 via-35% to-canvas to-65%"
        />
        <Container className="relative pt-32 pb-14 md:pt-40 md:pb-20">
          <Reveal>
            <div className="flex flex-col items-start gap-5">
              <Eyebrow icon={Sparkles}>About {COMPANY.legalName}</Eyebrow>
              <h1 className="max-w-3xl font-display text-[clamp(30px,5vw,54px)] leading-[1.06] font-semibold tracking-[-0.04em] text-ink text-balance">
                How stock moves from a source-market warehouse to your{" "}
                <span className="serif-accent text-accent">facility.</span>
              </h1>
              <p className="max-w-2xl text-body-lg text-ink-subtle">
                Cosmetics, skincare, fragrance, supplements, electronics,
                pet supplies, apparel and general cargo, moved from five
                source markets into Mumbai — who carries it, how customs
                clearance works, and what's included at every stage.
              </p>

              {/*
                Neumorphic, not the tinted-pill style status chips use
                elsewhere — this is a credentials list, and the raised/soft
                treatment reads as "physical documentation" rather than a
                live status. Unverified claims get a Clock4 instead of a
                checkmark rather than being hidden — see lib/company.ts's
                `verified` flag; overstating what's confirmed is worse than
                a chip that honestly says "pending".
              */}
              <ul className="mt-2 flex flex-wrap items-center gap-2">
                {COMPANY.credentials.map((c) => (
                  <li
                    key={c.label}
                    className="neuro-raised flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-caption text-ink-subtle"
                  >
                    {c.verified ? (
                      <CheckCircle2 className="size-3.5 text-semantic-success" strokeWidth={2} />
                    ) : (
                      <Clock4 className="size-3.5 text-ink-tertiary" strokeWidth={1.8} />
                    )}
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </Container>
      </div>

      {/* ---------------- Client strip ---------------- */}
      <section className="relative overflow-hidden border-t border-hairline pt-14 pb-14 md:pt-20 md:pb-20">
        <GlowOrb color="--color-vivid-violet" size="size-[24rem]" opacity={12} className="top-0 -left-24" />
        <GlowOrb color="--color-vivid-amber" size="size-[20rem]" opacity={11} className="top-10 -right-20" />
        <Container>
          <Reveal>
            {/*
                Was "Nykaa, Amazon, Flipkart and more ship with us" over a
                client logo strip — the same false claim the homepage
                carried. Those parcels move through the carriers we book,
                not through us.
            */}
            <SectionHeading
              eyebrow="Who we move for"
              eyebrowIcon={Users}
              title="Businesses moving stock they already own."
              body="Distributors, brand owners, and anyone with warehouses in two countries. Some ship a pallet a week, some ship one carton a month — we don't have a minimum that turns the second kind away, and the paperwork is the same either way."
              align="center"
            />
          </Reveal>
          <div className="mt-10">
            <CarrierStrip wide />
          </div>
        </Container>
      </section>

      {/* ---------------- Where we onboard ---------------- */}
      <Section id="origins" tone="raised">
        <Reveal>
          <SectionHeading
            eyebrow="Where we onboard"
            eyebrowIcon={Globe2}
            title="Where we collect, and where we deliver."
            body="Stock is collected and consolidated at the origin gateway, then flown to the destination market. Same two customs verifications, same bonded floor, same tracking record whichever market it came from. These are our highest-volume lanes, not the only ones we run — pick one for an indicative estimate, or reach out if yours isn't listed."
          />
        </Reveal>
        <div className="mt-12">
          <Origins />
        </div>
      </Section>

      {/* ---------------- Mumbai clearance ---------------- */}
      <Section id="clearance" className="overflow-hidden">
        <GlowOrb color="--color-vivid-blue" size="size-[22rem]" opacity={13} className="top-0 -right-24" />
        <Reveal>
          <SectionHeading
            eyebrow="Clearing Mumbai"
            eyebrowIcon={ShieldCheck}
            title="Two verifications, then the bonded floor."
            body="Customs check the paperwork first and the cartons second. Nothing moves to the bonded floor until both are signed off — so we screen for the things that fail the second check before the goods ever leave origin."
          />
        </Reveal>
        <div className="mt-12">
          <Clearance />
        </div>
      </Section>

      {/* ---------------- Features bento ---------------- */}
      <Section id="services" tone="raised" glow>
        <Reveal>
          <SectionHeading
            eyebrow="What we handle"
            eyebrowIcon={Sparkles}
            title="Built for the parts of freight that go wrong."
            body="Moving the box is the easy half. What costs you money is a registration that misses one SKU, stock that lands with eight months of shelf life left, or four days of silence after the vessel berths while your buyer asks where it is."
          />
        </Reveal>
        <div className="mt-12">
          <BentoFeatures />
        </div>
      </Section>

      {/* ---------------- Stats ---------------- */}
      <Container className="pt-4 pb-16 md:pt-6 md:pb-24">
        <Reveal>
          <StatsBand />
        </Reveal>
      </Container>

      {/* ---------------- What we turn down ---------------- */}
      <Section id="limits" className="overflow-hidden">
        <GlowOrb color="--color-vivid-coral" size="size-[20rem]" opacity={12} className="top-0 -left-20" />
        <Limits />
      </Section>

      {/* ---------------- Clients ---------------- */}
      <Section id="customers" tone="raised">
        <Reveal>
          <SectionHeading
            eyebrow="Clients"
            eyebrowIcon={Users}
            title="Who we move stock for."
            body="Marketplaces, retailers and distribution houses — from single-brand importers to platform-scale fulfilment. Most of them ship with us monthly."
          />
        </Reveal>
        <div className="mt-12">
          <ClientGrid />
        </div>
      </Section>

      {/* ---------------- CTA — full contact details live on /contact ---------------- */}
      <Container className="pb-16 md:pb-24">
        <Reveal>
          <div
            id="contact"
            className="gradient-border edge-lift noise relative scroll-mt-24 overflow-hidden rounded-xxl bg-surface-1 p-8 text-center shadow-xl md:p-16"
          >
            <Image
              src={IMAGES.containerShip.src}
              alt=""
              aria-hidden
              fill
              sizes="100vw"
              className="object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-canvas/70 via-canvas/90 to-canvas" />
            <div
              aria-hidden
              className="absolute -top-32 left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-primary/18 blur-[110px]"
            />

            <div className="relative z-[1]">
              <Eyebrow icon={Sparkles}>Get started</Eyebrow>
              <h2 className="mx-auto mt-6 max-w-3xl font-display text-[clamp(28px,4.4vw,52px)] leading-[1.08] font-semibold tracking-[-0.035em] text-ink text-balance">
                Sourcing overseas? We&rsquo;ll handle the{" "}
                <span className="serif-accent text-accent">landing.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-body-lg text-ink-subtle">
                Send a recent purchase order and get a landed-cost rate — or
                reach us directly by email, phone or WhatsApp.
              </p>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Magnetic>
                  <ButtonLink href="/contact" size="lg" icon={ArrowRight}>
                    Contact us
                  </ButtonLink>
                </Magnetic>
                <Magnetic>
                  <ButtonLink
                    href={`mailto:${COMPANY.email}`}
                    variant="secondary"
                    size="lg"
                    icon={Mail}
                  >
                    Email support
                  </ButtonLink>
                </Magnetic>
              </div>

              <p className="mt-7 font-mono text-mono text-ink-tertiary">
                {COMPANY.email} · {COMPANY.phone}
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </>
  );
}
