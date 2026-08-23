import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  Clock4,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
} from "lucide-react";
import { COMPANY } from "@/lib/company";
import { IMAGES } from "@/lib/images";
import ContactForm from "@/components/ContactForm";
import FAQAccordion from "@/components/FAQAccordion";
import { Magnetic, Reveal } from "@/components/motion/primitives";
import { ButtonLink, Card, Container, Eyebrow, IconTile } from "@/components/ui";

export const metadata: Metadata = {
  title: `Contact ${COMPANY.legalName}`,
  description:
    `Get in touch with ${COMPANY.legalName} — send a recent order for a door-to-door rate, or reach us directly by email, phone or WhatsApp.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <Container className="pt-32 pb-16 md:pt-40 md:pb-24">
      <Reveal>
        <div
          className="gradient-border edge-lift noise relative overflow-hidden rounded-xxl bg-surface-1 p-8 text-center shadow-xl md:p-16"
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
            <h1 className="mx-auto mt-6 max-w-3xl font-display text-[clamp(28px,4.4vw,52px)] leading-[1.08] font-semibold tracking-[-0.035em] text-ink text-balance">
              Sourcing overseas? We&rsquo;ll handle the{" "}
              <span className="serif-accent text-accent">landing.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-body-lg text-ink-subtle">
              Send a recent purchase order and we&rsquo;ll return a
              landed-cost rate, a realistic transit window, and your HS
              classification — usually by the next working day.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Magnetic>
                <ButtonLink href="/quote" size="lg" icon={ArrowRight}>
                  Get a quote
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
          </div>
        </div>
      </Reveal>

      {/* ---------------- Direct contact details ---------------- */}
      <Reveal delay={0.05}>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href={`mailto:${COMPANY.email}`}
            className="gradient-border edge-lift spotlight group flex flex-col items-center gap-3 rounded-xl border border-hairline bg-surface-1 p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
          >
            <IconTile icon={Mail} tone="blue" />
            <div>
              <p className="text-body-sm font-medium text-ink">Email</p>
              <p className="mt-0.5 text-caption text-ink-subtle">{COMPANY.email}</p>
            </div>
          </a>
          <a
            href={COMPANY.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="gradient-border edge-lift spotlight group flex flex-col items-center gap-3 rounded-xl border border-hairline bg-surface-1 p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
          >
            <IconTile icon={MessageCircle} tone="green" />
            <div>
              <p className="text-body-sm font-medium text-ink">WhatsApp</p>
              <p className="mt-0.5 text-caption text-ink-subtle">{COMPANY.whatsapp}</p>
            </div>
          </a>
          <a
            href={COMPANY.phoneHref}
            className="gradient-border edge-lift spotlight group flex flex-col items-center gap-3 rounded-xl border border-hairline bg-surface-1 p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
          >
            <IconTile icon={Phone} tone="violet" />
            <div>
              <p className="text-body-sm font-medium text-ink">Phone</p>
              <p className="mt-0.5 text-caption text-ink-subtle">{COMPANY.phone}</p>
            </div>
          </a>
          <div className="gradient-border edge-lift flex flex-col items-center gap-3 rounded-xl border border-hairline bg-surface-1 p-6 text-center shadow-sm">
            <IconTile icon={MapPin} tone="amber" />
            <div>
              <p className="text-body-sm font-medium text-ink">Warehouses</p>
              <p className="mt-0.5 text-caption text-ink-subtle">{COMPANY.locations}</p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---------------- Message form + photo panel ---------------- */}
      <Reveal delay={0.1}>
        <div className="mt-8 grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <h2 className="font-display text-headline text-ink">Send us a message</h2>
            <p className="mt-1.5 text-body-sm text-ink-subtle">
              Order questions, a rate request, or anything else — we read
              every message and reply from a real person, not a ticket bot.
            </p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </Card>

          <div className="relative min-h-[280px] overflow-hidden rounded-lg lg:col-span-2 lg:min-h-0">
            <Image
              src={IMAGES.warehouseAisle.src}
              alt={IMAGES.warehouseAisle.alt}
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="photo object-cover"
            />
            {/* Scrim is opaque canvas by the time it reaches the text (same
                approach as HeroPhotoBanner) — text sits on the ordinary
                ink token, not a hardcoded white, so it stays correct in
                both themes instead of tuning contrast against a photo. */}
            <div className="absolute inset-0 bg-gradient-to-t from-canvas from-5% via-canvas/55 via-45% to-transparent to-90%" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6">
              <div className="flex items-center gap-2 text-caption text-ink-subtle">
                <Clock4 className="size-3.5" strokeWidth={2} />
                Response time
              </div>
              <p className="font-display text-title font-semibold text-ink">
                Within 4 business hours
              </p>
              <p className="text-body-sm text-ink-subtle">
                Faster on WhatsApp during Mumbai office hours (Mon–Sat, 10:00–19:00 IST).
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---------------- FAQ ---------------- */}
      <Reveal delay={0.15}>
        <div className="mx-auto mt-8 max-w-2xl">
          <FAQAccordion />
        </div>
      </Reveal>
    </Container>
  );
}
