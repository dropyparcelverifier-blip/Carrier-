import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import Wordmark from "./Wordmark";
import { Container } from "./ui";
import { COMPANY } from "@/lib/company";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/track", label: "Track order" },
      { href: "/quote", label: "Get a quote" },
      { href: "/quote#how-it-works", label: "How it works" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/track#faq", label: "FAQ" },
      { href: "/about#contact", label: "Contact" },
    ],
  },
];

const CONTACT = [
  { icon: Mail, label: COMPANY.email, href: `mailto:${COMPANY.email}` },
  { icon: Phone, label: COMPANY.phone, href: COMPANY.phoneHref },
  { icon: MapPin, label: COMPANY.locations, href: null },
];

export default function Footer() {
  return (
    // The full multi-column footer is a website pattern — on mobile,
    // BottomNav owns navigation and /about carries this same contact info,
    // so it only renders at desktop widths.
    <footer className="hidden border-t border-hairline bg-surface-1 md:block">
      <Container className="py-14 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-sm text-body-sm text-ink-subtle">
              Premium US products shipped to India with full tracking from
              warehouse to doorstep.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {CONTACT.map(({ icon: Icon, label, href }) => (
                <li key={label} className="flex items-center gap-2.5 text-body-sm text-ink-subtle">
                  <Icon className="size-4 text-ink-tertiary" strokeWidth={1.8} />
                  {href ? (
                    <a href={href} className="hover:text-ink transition-colors">{label}</a>
                  ) : (
                    <span>{label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-caption font-medium text-ink">{col.title}</h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map(({ href, label }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="group flex items-center gap-1.5 text-body-sm text-ink-subtle transition-colors hover:text-ink"
                    >
                      {label}
                      <ArrowUpRight className="size-3 text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-8 text-caption text-ink-tertiary">
          <p>© {new Date().getFullYear()} Dropy. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
}
