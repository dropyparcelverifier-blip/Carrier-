import type { Metadata } from "next";
import { COMPANY } from "@/lib/company";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: `Cargo Claims — ${COMPANY.legalName}`,
  description: `How to report a damaged, missing or delayed shipment, and the deadlines that apply.`,
  alternates: { canonical: "/cargo-claims" },
};

export default function CargoClaimsPage() {
  return (
    <LegalPage title="Cargo Claims" updated="20 August 2026">
      <h2>Before you file</h2>
      <p>
        Every shipment is photo-verified at packing and again on arrival at
        our arrival warehouses, so most discrepancies are caught before
        delivery. If something still arrives damaged, short, or
        doesn&rsquo;t arrive at all, here&rsquo;s how to report it.
      </p>

      <h2>Reporting deadlines</h2>
      <ul>
        <li>
          <strong>Visible damage or shortage on delivery</strong> — note it
          on the delivery receipt at the time of handover if possible, and
          report to us within <strong>3 days</strong> of delivery.
        </li>
        <li>
          <strong>Concealed damage</strong> (not apparent until the package
          is opened) — report within <strong>7 days</strong> of delivery.
        </li>
        <li>
          <strong>Non-delivery / lost shipment</strong> — report within{" "}
          <strong>30 days</strong> of the original estimated delivery date.
        </li>
      </ul>
      <p>
        Claims reported after these windows may not be eligible for
        resolution, since verification against our handling and courier
        records becomes materially harder the longer the gap.
      </p>

      <h2>What to include</h2>
      <ul>
        <li>Your tracking ID and the phone number registered to the order.</li>
        <li>Photos of the damaged item and its packaging, if applicable.</li>
        <li>A brief description of what&rsquo;s missing, damaged or wrong.</li>
      </ul>

      <h2>How to file</h2>
      <p>
        Email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or call{" "}
        <a href={COMPANY.phoneHref}>{COMPANY.phone}</a> with the details above. We&rsquo;ll acknowledge your claim and
        confirm next steps, referencing the packing photos and delivery
        record already on file for that shipment.
      </p>

      <h2>Resolution</h2>
      <p>
        Once a claim is filed, we investigate against our own handling
        records and the carrier&rsquo;s delivery confirmation. Resolution —
        replacement, reshipment, or compensation, as applicable — is
        subject to the liability limits set out in our{" "}
        <a href="/terms">Terms of Service</a>. A consignment held at customs because it
        contains a restricted or undeclared item is not eligible for a delay
        claim under this policy.
      </p>
    </LegalPage>
  );
}
