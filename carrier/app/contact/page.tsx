import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  Clock4,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Sparkles,
} from "lucide-react";
import { COMPANY } from "@/lib/company";
import { IMAGES } from "@/lib/images";
import EnquiryForm from "@/components/EnquiryForm";
import FAQAccordion, { CONTACT_FAQS } from "@/components/FAQAccordion";
import { Magnetic, Reveal } from "@/components/motion/primitives";
import { ButtonLink, Card, Container, Eyebrow, IconTile } from "@/components/ui";

export const metadata: Metadata = {
  title: `Contact ${COMPANY.legalName}`,
  description:
    `Get in touch with ${COMPANY.legalName} — send a recent purchase order for a landed-cost rate, or reach us directly by email or phone.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <Container className="pt-32 pb-16 md:pt-40 md:pb-24">
      {/*
          Was a large "Sourcing overseas?" hero card and a row of four
          contact tiles. Both are gone: this page has one job, and two
          full-width blocks above the form pushed it below the fold.

          A short heading, then the form. Email and phone live in the
          panel beside it, where they support the form rather than
          competing with it.
      */}
      <Reveal>
        <div className="mb-8">
          <Eyebrow icon={Sparkles}>Get in touch</Eyebrow>
          <h1 className="mt-5 max-w-2xl font-display text-[clamp(28px,4.4vw,46px)] leading-[1.08] font-semibold tracking-[-0.035em] text-ink text-balance">
            Tell us what you&rsquo;re moving.
          </h1>
          <p className="mt-4 max-w-xl text-body text-ink-subtle">
            Send us the route, the rough weight and how often it runs, and
            we&rsquo;ll come back with a landed-cost rate and a realistic
            transit window &mdash; usually by the next working day.
          </p>
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
              <EnquiryForm />
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
                Office hours are Mon–Sat, 10:00–19:00 IST.
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---------------- FAQ ---------------- */}
      <Reveal delay={0.15}>
        <div className="mx-auto mt-8 max-w-2xl">
          <FAQAccordion items={CONTACT_FAQS} />
        </div>
      </Reveal>
    </Container>
  );
}
