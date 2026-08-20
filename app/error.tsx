"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { Container, Button, ButtonLink, Eyebrow } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <Container className="flex min-h-[70vh] flex-col items-center justify-center pt-32 pb-20 text-center md:pt-40 md:pb-28">
      <Eyebrow icon={AlertTriangle}>Something went wrong</Eyebrow>
      <h1 className="mt-5 font-display text-[clamp(28px,4.4vw,40px)] font-semibold tracking-[-0.03em] text-ink">
        We hit a snag loading this page
      </h1>
      <p className="mt-3 max-w-md text-body-sm text-ink-subtle">
        Our team has been notified. You can try again, or head back to home.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()} icon={RotateCw}>
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary" icon={Home}>
          Back to home
        </ButtonLink>
      </div>
    </Container>
  );
}
