import type { Metadata } from "next";
import { COMPANY } from "@/lib/company";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: `Terms of Service — ${COMPANY.legalName}`,
  description: `The terms that apply to using ${COMPANY.legalName}'s tracking tool, shipping estimator, and freight services.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="20 August 2026">
      <h2>What this covers</h2>
      <p>
        These terms apply to anyone using {COMPANY.legalName}&rsquo;s
        website — tracking a shipment, requesting a shipping estimate, or
        contacting support — and to the freight and customs-clearance
        services we provide as a carrier.
      </p>

      <h2>Tracking accuracy</h2>
      <p>
        Tracking statuses reflect the latest information available to us at
        each stage of transit. Between scans, the status shown may advance
        based on typical transit timing for that stage rather than a fresh
        physical scan — this gives a more current picture than waiting for
        the next checkpoint, but it is an estimate of progress, not a
        guarantee that the shipment has reached exactly that point.
      </p>

      <h2>Estimates are not binding quotes</h2>
      <p>
        The shipping cost calculator on this site gives a rule-based,
        indicative estimate — not a live carrier quote or a binding
        contract. Estimated timelines are similarly indicative: actual
        transit and customs clearance times vary with flight availability,
        customs load, weather and other factors outside our control. A
        confirmed rate and transit window is issued separately once we have
        your actual shipment details.
      </p>

      <h2>Liability for delay or damage</h2>
      <p>
        We take reasonable care in handling, storing and transporting your
        shipment, including photo verification at key handling points. Our
        liability for loss, damage or delay is limited as set out in the
        carriage terms applicable to your shipment and, where relevant, the
        Carriage by Air / Carriage by Sea conventions that govern
        international freight. See{" "}
        <a href="/cargo-claims">Cargo Claims</a> for how to report a
        problem and the deadlines that apply.
      </p>

      <h2>Customs and duties</h2>
      <p>
        Import duty, IGST and other government levies are the
        responsibility of the importer of record and are separate from our
        freight and handling charges, except where explicitly included in
        a quote. Some goods can&rsquo;t be booked at all, or need
        registration confirmed before they ship — see{" "}
        <a href="/prohibited-items">Prohibited &amp; Restricted Items</a>.
      </p>

      <h2>Website availability</h2>
      <p>
        We aim to keep tracking and quoting available at all times but
        don&rsquo;t guarantee uninterrupted access — maintenance, upstream
        outages or factors beyond our control can affect the site. A
        website outage does not affect the physical movement of your
        shipment.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The date at the top of
        this page reflects the last revision.
      </p>

      <h2>Related policies</h2>
      <p>
        See our <a href="/privacy">Privacy Policy</a> for how we handle
        your information, and <a href="/cargo-claims">Cargo Claims</a> for
        how to report a damaged, missing or delayed shipment.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can be sent to{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or{" "}
        {COMPANY.phone}.
      </p>
    </LegalPage>
  );
}
