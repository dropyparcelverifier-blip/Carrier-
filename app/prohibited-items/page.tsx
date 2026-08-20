import type { Metadata } from "next";
import { COMPANY } from "@/lib/company";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: `Prohibited & Restricted Items — ${COMPANY.legalName}`,
  description: `What we can't ship into India, what needs registration first, and what we turn down as a matter of policy even when it's technically importable.`,
  alternates: { canonical: "/prohibited-items" },
};

export default function ProhibitedItemsPage() {
  return (
    <LegalPage title="Prohibited & restricted items" updated="20 August 2026">
      <h2>Why this list exists</h2>
      <p>
        India customs prohibits some goods outright and restricts others
        behind a registration or licence. We check every booking against
        this list at origin — before it ships — because a consignment held
        at Mumbai air cargo or Nhava Sheva costs everyone far more than a
        booking we simply decline up front.
      </p>

      <h2>Never accepted, under any circumstances</h2>
      <p>
        Prohibited under the Customs Act, 1962 and India&rsquo;s Foreign
        Trade Policy. No registration or licence changes this — we will not
        book these:
      </p>
      <ul>
        <li>Narcotics and psychotropic substances</li>
        <li>Counterfeit currency</li>
        <li>Pornographic or obscene material</li>
        <li>
          Counterfeit or IPR-infringing goods (replica/fake branded products)
        </li>
        <li>
          Wildlife products under CITES and the Wildlife Protection Act, 1972
          — ivory, animal skins, horns, bones, coral, shells, feathers
        </li>
        <li>Arms, ammunition, and satellite phones or drones without prior clearance</li>
      </ul>

      <h2>Restricted — importable only with registration</h2>
      <p>
        These categories can move, but only once the right registration is
        confirmed. We verify this before a booking is accepted, not after it
        lands.
      </p>

      <h3>Cosmetics &amp; skincare</h3>
      <ul>
        <li>
          <strong>Not importable at all:</strong> any cosmetic tested on
          animals after 12 November 2014 (Cosmetics Rules, 2020, Rule
          39(7)) — this is a flat ban, not a registration gap.
        </li>
        <li>
          Everything else needs a CDSCO Import Registration Certificate
          (Form COS-1) covering that exact SKU, plus a non-animal-testing
          declaration. We check your registration against your SKU list
          before the goods leave origin — see{" "}
          <a href="/about#clearance">how Mumbai clearance works</a>.
        </li>
      </ul>

      <h3>Supplements &amp; nutraceuticals</h3>
      <ul>
        <li>
          FSSAI classes these &ldquo;high-risk&rdquo; — import needs FSSAI
          clearance filed per consignment, at a designated port of entry.
        </li>
        <li>
          Flatly restricted ingredients: ephedra, aristolochic acid,
          anabolic steroids and other hormonal agents, caffeine above
          200&nbsp;mg per serving, theobromine above 100&nbsp;mg per
          serving, and GM-origin ingredients.
        </li>
      </ul>

      <h3>Electronics &amp; accessories</h3>
      <ul>
        <li>
          Mobile phones, laptops, tablets, power banks, wireless devices and
          LED products need BIS registration (Compulsory Registration
          Scheme) before import — unregistered units are held at port.
        </li>
        <li>
          <strong>Standalone lithium-ion batteries are banned from air
          transport entirely</strong> (IATA UN3480) — a spare power bank or
          battery shipped on its own cannot fly, full stop. A battery
          packed inside its device (UN3481, e.g. a phone or laptop) can fly
          air freight under IATA&rsquo;s state-of-charge and quantity
          limits.
        </li>
      </ul>

      <h3>Fragrance &amp; alcohol-based products</h3>
      <p>
        Perfume is an IATA Class 3 dangerous good (UN1266) because of its
        alcohol content. Air courier limits cap out at 500&nbsp;ml per
        container and 2&nbsp;litres total per shipment. Many premium
        fragrances run 60&ndash;85% ABV — above what standard air courier
        handles without hazmat-compliant packaging, which is why fragrance
        already carries a dangerous-goods surcharge on our{" "}
        <a href="/quote">shipping estimate</a>.
      </p>

      <h3>Pet supplies</h3>
      <p>
        Toys, leashes and non-food items ship with no special restriction.
        Anything containing meat, dairy, or other animal-derived
        ingredients (pet food, treats, chews) needs a Sanitary Import
        Permit from India&rsquo;s Animal Quarantine &amp; Certification
        Services, obtained <em>before</em> the shipment leaves origin, plus
        a veterinary health certificate.
      </p>

      <h2>What we turn down as a matter of policy</h2>
      <p>
        Some of the above is technically importable with enough paperwork —
        we still won&rsquo;t book it, because the paperwork isn&rsquo;t
        something a courier shipment can realistically clear in time:
      </p>
      <ul>
        <li>
          Any pet food or animal-derived pet product without a Sanitary
          Import Permit already in hand — the permit takes weeks to obtain
          and can&rsquo;t be arranged after the parcel ships.
        </li>
        <li>
          Standalone lithium-ion batteries or power banks shipped alone
          (banned on passenger aircraft regardless of paperwork).
        </li>
        <li>
          Full-strength perfume concentrate above safe air-courier ABV
          thresholds without dedicated hazmat packaging and declaration.
        </li>
        <li>
          Any cosmetic or supplement brand without CDSCO or FSSAI
          registration already confirmed for that SKU — customs holds these
          at the terminal regardless of how well we&rsquo;ve packed them.
        </li>
        <li>
          Single high-value jewellery or loose precious stones — separate
          valuation and GJEPC requirements sit outside what we handle.
        </li>
      </ul>
      <p>
        Not sure whether something on your list qualifies? Email{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or WhatsApp{" "}
        <a href={COMPANY.whatsappHref}>{COMPANY.whatsapp}</a> before you
        book — checking first is free; a held consignment at customs is not.
      </p>

      <h2>Related policies</h2>
      <p>
        See our <a href="/terms">Terms of Service</a> for how liability
        works, and <a href="/cargo-claims">Cargo Claims</a> for how to
        report a problem with a shipment that already booked.
      </p>
    </LegalPage>
  );
}
