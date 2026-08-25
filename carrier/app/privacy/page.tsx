import type { Metadata } from "next";
import { COMPANY } from "@/lib/company";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: `Privacy Policy — ${COMPANY.legalName}`,
  description: `How ${COMPANY.legalName} collects, uses and protects the information you share when tracking an order, requesting a quote, or contacting support.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="20 August 2026">
      <h2>What we collect</h2>
      <p>
        We collect only what&rsquo;s needed to move and track your shipment:
      </p>
      <ul>
        <li>
          <strong>Order tracking</strong> — your tracking ID and the
          phone number registered to that order, used to verify your
          identity before showing shipment status.
        </li>
        <li>
          <strong>Shipping estimates</strong> — origin country, package
          weight and product category, used only to calculate an indicative
          rate. We don&rsquo;t store estimate requests against your identity.
        </li>
        <li>
          <strong>Contact requests</strong> — your name, email, phone number
          and order details when you email or WhatsApp us directly.
        </li>
        <li>
          <strong>Shipment records</strong> — customer name, mobile number,
          delivery address, item descriptions and weights, and the US order
          reference for each consignment we carry, supplied by our clients
          (the marketplace, retailer or seller you ordered from) so we can
          fulfil delivery.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Your information is used to clear customs, generate tracking
        updates, calculate shipping costs, and respond to support requests.
        We do not sell your information, and we do not use it for
        advertising.
      </p>

      <h2>Who we share it with</h2>
      <p>
        Shipment data is shared with the carriers, customs brokers and
        last-mile couriers directly involved in moving your consignment —
        no further than is needed to deliver it. Where a client (the
        marketplace or seller you ordered from) has supplied us your
        details to fulfil an order, we act as their logistics partner for
        that shipment only.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Shipment and tracking records are retained for as long as needed for
        customs, tax and dispute-resolution purposes, consistent with
        Indian regulatory retention requirements, after which they are
        deleted or anonymised.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us what information we hold about a shipment, request a
        correction, or ask us to delete records once they&rsquo;re no
        longer required for the reasons above. Reach out using the details
        below.
      </p>

      <h2>Related policies</h2>
      <p>
        This page covers the personal information we handle. For what this
        site stores in your browser (not the same thing), see our{" "}
        <a href="/cookies">Cookie Policy</a>. For the terms that apply to
        using our tracking and quoting tools, see our{" "}
        <a href="/terms">Terms of Service</a>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy can be sent to{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> or{" "}
        {COMPANY.phone}.
      </p>
    </LegalPage>
  );
}
