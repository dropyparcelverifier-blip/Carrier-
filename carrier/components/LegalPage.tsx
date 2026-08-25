import { Reveal } from "./motion/primitives";
import { Container } from "./ui";

/**
 * Shared shell for the four legal/policy pages (Privacy, Terms, Cargo
 * Claims, Cookies) — plain prose, not the marketing-page treatment
 * (Eyebrow/photo banner/CTA buttons) the rest of the site uses. A policy
 * page's job is to be read and cited, not sold.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <Container className="pt-32 pb-20 md:pt-40 md:pb-28">
      <Reveal>
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-[clamp(28px,4.4vw,40px)] font-semibold tracking-[-0.03em] text-ink">
            {title}
          </h1>
          <p className="mt-2 text-caption text-ink-tertiary">
            Last updated {updated}
          </p>
          <div className="legal-prose mt-10">{children}</div>
        </div>
      </Reveal>
    </Container>
  );
}
