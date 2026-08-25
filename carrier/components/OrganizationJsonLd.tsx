import { COMPANY } from "@/lib/company";

const SITE_URL = "https://dotconnectslogistics.in";

/**
 * Organization structured data — read by Google (and other agents/crawlers)
 * to understand who runs this site, independent of what any single page's
 * prose says. Rendered once in the root layout rather than per-page, since
 * the organization itself doesn't change page to page. sameAs lists the
 * social profiles COMPANY.social already carries elsewhere on the site, so
 * Google can connect this site to those profiles as the same entity.
 */
export default function OrganizationJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: COMPANY.legalName,
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512`,
    foundingDate: String(COMPANY.foundedYear),
    email: COMPANY.email,
    telephone: COMPANY.phone,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Navi Mumbai",
      addressRegion: "Maharashtra",
      addressCountry: "IN",
    },
    sameAs: COMPANY.social.map((s) => s.href),
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify of a fixed, code-defined object (no user input),
      // the same trust boundary as the inline theme-init script already in
      // app/layout.tsx — not a dangerouslySetInnerHTML of anything a
      // visitor or another user could influence.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
