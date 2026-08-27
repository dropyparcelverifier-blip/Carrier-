import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock4, Mail, MapPin, Phone, X } from "lucide-react";
import Wordmark from "./Wordmark";
import { Container, cx } from "./ui";
import { COMPANY } from "@/lib/company";
import { IMAGES } from "@/lib/images";
import { TRACKING_ORIGIN } from "@/lib/tracking-site";
import { ORIGINS } from "@/lib/network";

/* lucide-react ships no brand marks for these three — inline SVGs instead,
   sized/stroked to sit visually even with the lucide icons around them. */
function WhatsappIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.005c5.46 0 9.91-4.45 9.91-9.91C21.98 6.45 17.5 2 12.04 2Zm0 18.13h-.004a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.26-4.36c0-4.52 3.68-8.2 8.21-8.2 2.19 0 4.25.85 5.8 2.4a8.14 8.14 0 0 1 2.4 5.8c0 4.52-3.68 8.22-8.19 8.22Zm4.5-6.15c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.15.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08s.9 2.41 1.02 2.58c.12.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  );
}
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13.5 21v-7.5h2.5l.4-3H13.5V8.4c0-.87.24-1.46 1.5-1.46h1.6V4.32C16.32 4.22 15.44 4 14.4 4c-2.16 0-3.64 1.32-3.64 3.74V10.5H8.25v3H10.76V21h2.74Z" />
    </svg>
  );
}

const SOCIAL_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Instagram: InstagramIcon,
  X: X,
  Facebook: FacebookIcon,
};

// Mirrors the top nav's page-level structure (see TopNav.tsx) plus the
// section anchors each page actually carries, so a footer click always
// lands somewhere real instead of drifting out of sync with the pages.
const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: TRACKING_ORIGIN, label: "Track a consignment", external: true },
      { href: "/quote", label: "Get a quote" },
      { href: "/#coverage", label: "Coverage" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/about#services", label: "What you get" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/#faq", label: "FAQ" },
      { href: `mailto:${COMPANY.email}`, label: "Email support" },
    ],
  },
];

const CONTACT = [
  { icon: Mail, label: COMPANY.email, href: `mailto:${COMPANY.email}` },
  { icon: Phone, label: COMPANY.phone, href: COMPANY.phoneHref },
  { icon: MapPin, label: COMPANY.locations, href: null },
];

// A quick trust readout for the footer's CTA card — kept tiny (2 values,
// not the full homepage stat row) so it reads as a supporting detail next
// to the CTA, not a competing block.
/**
 * Was "11.4K+ consignments cleared" and "98.2% delivered on ETA" — the
 * same two invented figures the hero and /about carried. Derived from
 * lib/network.ts now, like the rest.
 */
const FOOTER_STATS = [
  { value: `${ORIGINS.length}`, label: "Source markets" },
  { value: "2", label: "Own warehouses" },
];


const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/cargo-claims", label: "Cargo Claims" },
  { href: "/cookies", label: "Cookie Policy" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-hairline bg-surface-2">
      {/* ── Desktop: full multi-column footer — BottomNav is mobile's
          navigation surface, so the link columns only earn their keep at
          desktop widths where there's room for them beside the brand
          block. A quiet warehouse photo + violet wash gives the section the
          same layered depth every other page section already has, instead
          of ending the page on a flat text field. ── */}
      <div className="relative hidden md:block">
        <div aria-hidden className="absolute inset-0 -z-10">
          <Image
            src={IMAGES.warehouseRacking.src}
            alt=""
            fill
            sizes="100vw"
            // 0.07 read as flat white — no photo was actually visible.
            // Anchored to the top edge (object-top) and faded out well
            // before the copyright bar, so it reads as a real photographic
            // band at the top of the footer rather than a uniform faint
            // tile across the whole section.
            className="photo object-cover object-top opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-surface-1/40 via-surface-1/95 to-surface-1" />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[110px]"
        />

        <Container className="py-16 md:py-20">
          {/* Five columns only from lg. They were on md, and they did not
              fit: an `fr` track floors at min-content, the brand column's
              min-content is set by the unbreakable
              queries@dotconnectslogistics.com, and at 768 that took 270 of
              the 704px available. The remaining four tracks got 82/70/87/67px
              — the "Ship with us" card collapsed to 67px with its two stat
              labels printed on top of each other.

              xl, not lg: five columns need ~958px of track before the brand
              column drops under that 270px address. At lg the 1.2fr track
              lands on 208px and the address breaks mid-domain
              ("queries@dotconnectslogi / stics.com"), which is a worse thing
              to show a prospect than a two-column footer. At xl the track is
              272px and it sits on one line. */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-12 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_1.2fr]">
            <div className="col-span-2 min-w-0 lg:col-span-1">
              <Wordmark />
              <p className="mt-4 max-w-sm text-body-sm text-ink-subtle">
                B2B freight and internal stock transfers,
                tracked warehouse to warehouse.
              </p>

              <ul className="mt-5 flex flex-wrap items-center gap-2">
                {COMPANY.credentials.map((c) => (
                  <li
                    key={c.label}
                    className="neuro-raised flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-caption text-ink-subtle"
                  >
                    {c.verified ? (
                      <CheckCircle2 className="size-3 text-semantic-success" strokeWidth={2} />
                    ) : (
                      <Clock4 className="size-3 text-ink-tertiary" strokeWidth={1.8} />
                    )}
                    {c.label}
                  </li>
                ))}
              </ul>

              <ul className="mt-6 flex flex-col gap-3">
                {CONTACT.map(({ icon: Icon, label, href }) => (
                  <li key={label} className="flex min-w-0 items-center gap-2.5 text-body-sm text-ink-subtle">
                    <span className="neuro-surface neuro-raised flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-tertiary">
                      <Icon className="size-3.5" strokeWidth={1.8} />
                    </span>
                    {/* No break-words here, deliberately: the grid above now
                        only asks for five columns at a width where the
                        address fits on one line, and a support address split
                        mid-domain reads as a typo. The mobile footer does
                        break it, because at 320 there is no alternative. */}
                    {href ? (
                      <a href={href} className="transition-colors hover:text-ink">{label}</a>
                    ) : (
                      <span>{label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="text-caption font-semibold tracking-wide text-ink uppercase">{col.title}</h3>
                <ul className="mt-4 flex flex-col gap-3">
                  {col.links.map(({ href, label }) => {
                    const external = href.startsWith("mailto:") || href.startsWith("http");
                    const linkClass = "group flex items-center gap-1.5 text-body-sm text-ink-subtle transition-colors hover:text-ink";
                    return (
                      <li key={label}>
                        {external ? (
                          <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={linkClass}>
                            {label}
                            <ArrowUpRight className="size-3 text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} />
                          </a>
                        ) : (
                          <Link href={href} className={linkClass}>
                            {label}
                            <ArrowUpRight className="size-3 text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {/* 4th content block, filling the space three link columns
                left empty at desktop widths — a real conversion path
                (get a quote) instead of just widening the existing
                columns, with a couple of trust stats to back it up.
                self-start: without it, `grid` stretches this card to match
                the tallest sibling (the Product/Company/Support columns),
                which left a large dead gap below the stats on any row with
                fewer links. The card now hugs its own content height and a
                violet-tinted surface + inset glow give it real presence
                instead of blending into the flat surrounding surface. */}
            <div className="neuro-surface neuro-raised relative flex flex-col self-start overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-b from-primary/[0.06] to-transparent p-5">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-primary/20 blur-[50px]"
              />
              <span className="neuro-surface neuro-raised relative flex size-9 items-center justify-center rounded-lg text-primary">
                <ArrowRight className="size-4" strokeWidth={2} />
              </span>
              <h3 className="relative mt-3.5 text-body-sm font-semibold text-ink">Ship with us</h3>
              <p className="relative mt-1.5 text-caption text-ink-subtle">
                Get a landed-cost quote in minutes — no account needed.
              </p>
              <Link
                href="/quote"
                className="group relative mt-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-primary transition-colors hover:text-primary-hover"
              >
                Get a quote
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
              </Link>

              <dl className="relative mt-5 grid grid-cols-2 gap-3 border-t border-primary/15 pt-4">
                {FOOTER_STATS.map((s) => (
                  <div key={s.label}>
                    <dd className="font-display text-body-lg font-semibold tracking-[-0.02em] text-ink">{s.value}</dd>
                    <dt className="mt-0.5 text-[11px] leading-tight text-ink-tertiary">{s.label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="neuro-surface neuro-pressed mt-14 flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4 text-caption text-ink-tertiary">
            <p>© {year} {COMPANY.legalName}. All rights reserved.</p>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {LEGAL_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="transition-colors hover:text-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </div>

      {/* ── Mobile: compact — contact + socials + copyright only.
          BottomNav already owns page navigation (Home/Quote/About/Contact),
          so this isn't a second nav, just the info that has nowhere else to
          live on mobile: how to reach support and where the socials are.
          Same pb-[8rem+safe-area] formula app/layout.tsx uses for <main> —
          BottomNav's real rendered height plus its own floating offset runs
          well past a flat pb-28 (112px), which let the last row of legal
          links sit underneath the bar instead of above it. ── */}
      <div className="relative overflow-hidden px-5 pt-10 pb-[calc(8rem+env(safe-area-inset-bottom))] md:hidden">
        {/* Same warehouse photo + violet wash as the desktop footer, scaled
            down — this block used to be plain flat text on bg-surface-1,
            noticeably less designed than the rest of the page above it. */}
        <div aria-hidden className="absolute inset-0 -z-10">
          <Image
            src={IMAGES.warehouseRacking.src}
            alt=""
            fill
            sizes="100vw"
            className="photo object-cover opacity-[0.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-surface-1 via-surface-1/98 to-surface-1" />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-full bg-primary/10 blur-[80px]"
        />
        <Wordmark />
        <p className="mt-3 max-w-xs text-body-sm text-ink-subtle">
          B2B freight and internal stock transfers, tracked
          warehouse to warehouse.
        </p>

        <ul className="mt-4 flex flex-wrap gap-2">
          {COMPANY.credentials.map((c) => (
            <li
              key={c.label}
              className="neuro-raised flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-caption whitespace-nowrap text-ink-subtle"
            >
              {c.verified ? (
                <CheckCircle2 className="size-3 shrink-0 text-semantic-success" strokeWidth={2} />
              ) : (
                <Clock4 className="size-3 shrink-0 text-ink-tertiary" strokeWidth={1.8} />
              )}
              {c.label}
            </li>
          ))}
        </ul>

        {/* Grouped into one raised card, matching the neumorphic surfaces
            every other section on the site uses for a related cluster of
            info — a bare list of lines read flatter than the rest of the
            page's card-based language. */}
        <ul className="neuro-surface neuro-raised mt-5 flex flex-col gap-3.5 rounded-xl p-4">
          {CONTACT.map(({ icon: Icon, label, href }) => (
            <li key={label} className="flex min-w-0 items-center gap-3 text-body-sm text-ink-subtle">
              <span className="neuro-pressed-sm flex size-8 shrink-0 items-center justify-center rounded-lg text-primary">
                <Icon className="size-3.5" strokeWidth={1.8} />
              </span>
              {/* At 320 the support address is wider than the card's content
                  box and ran 12px past its rounded border into the page. */}
              {href ? (
                <a href={href} className="min-w-0 break-words transition-colors hover:text-ink">{label}</a>
              ) : (
                <span className="min-w-0 break-words">{label}</span>
              )}
            </li>
          ))}
        </ul>

        {/* Same neuro-pressed bar treatment as the desktop footer's
            copyright/legal row, instead of a bare border-top divider — the
            plainest-looking part of the old mobile footer. */}
        <div className="neuro-surface neuro-pressed mt-6 rounded-xl p-4">
          {/* wrap + shrink-0: at 320 the social row was pushed 6px past the
              card's border rather than dropping to its own line. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <p className="min-w-0 text-caption text-ink-tertiary">© {year} {COMPANY.legalName}</p>
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2.5 border-t border-hairline pt-4 text-caption text-ink-tertiary">
            {LEGAL_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="transition-colors hover:text-ink">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
