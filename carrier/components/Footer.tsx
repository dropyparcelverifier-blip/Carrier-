import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock4, Mail, MapPin, X } from "lucide-react";
import Wordmark from "./Wordmark";
import EmailText from "./EmailText";
import { Container, cx } from "./ui";
import { COMPANY } from "@/lib/company";
import { IMAGES } from "@/lib/images";
import { TRACKING_ORIGIN } from "@/lib/tracking-site";
import { ORIGINS } from "@/lib/network";

/* lucide-react ships no brand marks for these two — inline SVGs instead,
   sized/stroked to sit visually even with the lucide icons around them. */
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

// Email only — no phone line. See COMPANY.email.
const CONTACT = [
  { id: "email", icon: Mail, label: <EmailText />, href: `mailto:${COMPANY.email}` },
  { id: "where", icon: MapPin, label: COMPANY.locations, href: null },
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
          {/* Five columns only from xl. On md they did not fit: the
              support address sets the brand column's width, and at 768 it
              took 270 of the 704px available — the "Ship with us" card
              collapsed to 67px with its stat labels printed on top of each
              other. Below xl it's two columns, where the address has room.

              At xl the address stays on ONE line (a support address split
              mid-way reads as a typo). contact-us@dotconnectslogistics.com
              needs 289px with its icon; at 1.2fr the brand track was 272px
              and the address ran into the gutter. 1.3fr gives it 298px. The
              link columns pay for it: 0.75fr is 172px, and their longest
              item, "Track a consignment" with its arrow, needs 156px. */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-12 xl:grid-cols-[1.3fr_0.75fr_0.75fr_0.75fr_1.2fr]">
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
                {CONTACT.map(({ id, icon: Icon, label, href }) => (
                  <li key={id} className="flex min-w-0 items-center gap-2.5 text-body-sm text-ink-subtle">
                    <span className="neuro-surface neuro-raised flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-tertiary">
                      <Icon className="size-3.5" strokeWidth={1.8} />
                    </span>
                    {/* whitespace-nowrap, deliberately: the address has a
                        hyphen, and without this it broke as "contact-" /
                        "us@…" at 1280px and up. The grid above sizes the
                        brand column to fit it on one line. The mobile footer
                        does let it break — after the "@", never at the
                        hyphen — because at 320 there is no alternative. */}
                    {href ? (
                      <a href={href} className="whitespace-nowrap transition-colors hover:text-ink">{label}</a>
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
          {CONTACT.map(({ id, icon: Icon, label, href }) => (
            <li key={id} className="flex min-w-0 items-center gap-3 text-body-sm text-ink-subtle">
              <span className="neuro-pressed-sm flex size-8 shrink-0 items-center justify-center rounded-lg text-primary">
                <Icon className="size-3.5" strokeWidth={1.8} />
              </span>
              {/* At 320 the support address is wider than the card's content
                  box and ran 12px past its rounded border into the page.
                  EmailText makes it break after the "@", not at the hyphen. */}
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
