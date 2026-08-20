import { PackageSearch, Home, Calculator } from "lucide-react";
import { Container, ButtonLink, Eyebrow } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="flex min-h-[70vh] flex-col items-center justify-center pt-32 pb-20 text-center md:pt-40 md:pb-28">
      <Eyebrow icon={PackageSearch}>404</Eyebrow>
      <h1 className="mt-5 font-display text-[clamp(28px,4.4vw,40px)] font-semibold tracking-[-0.03em] text-ink">
        This page didn&apos;t make it to the destination
      </h1>
      <p className="mt-3 max-w-md text-body-sm text-ink-subtle">
        The link you followed may be broken, or the page may have moved. Let&apos;s get you back on route.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/" icon={Home}>
          Back to home
        </ButtonLink>
        <ButtonLink href="/track" variant="secondary" icon={PackageSearch}>
          Track a shipment
        </ButtonLink>
        <ButtonLink href="/quote" variant="ghost" icon={Calculator}>
          Get a quote
        </ButtonLink>
      </div>
    </Container>
  );
}
