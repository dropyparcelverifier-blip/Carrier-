import type { Metadata } from "next";
import { COMPANY } from "@/lib/company";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: `Cookie Policy — ${COMPANY.legalName}`,
  description: `What this site stores in your browser, and why.`,
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated="20 August 2026">
      <h2>What we store</h2>
      <p>
        This site keeps its footprint deliberately small. Here&rsquo;s
        everything it stores in your browser:
      </p>
      <ul>
        <li>
          <strong>Theme preference</strong> (<code>dropy-theme</code>,
          browser localStorage) — remembers whether you&rsquo;ve switched
          to dark mode, so the site opens the way you left it. Not sent to
          our servers.
        </li>
        <li>
          <strong>Admin session</strong> (<code>dropy_admin_session</code>,
          httpOnly cookie) — set only when a staff member signs in to the
          order-management console, to keep them signed in. Not set for
          ordinary visitors tracking an order or getting a quote.
        </li>
      </ul>

      <h2>What we don&rsquo;t use</h2>
      <p>
        We don&rsquo;t currently run third-party analytics or advertising
        trackers (no Google Analytics, no ad pixels) on this site. If that
        changes, this page will be updated to name the specific tracking
        technologies added and what they collect.
      </p>

      <h2>Managing storage</h2>
      <p>
        You can clear localStorage and cookies at any time through your
        browser&rsquo;s settings. Doing so simply resets your theme
        preference and signs out any active admin session — it doesn&rsquo;t
        affect your shipment or tracking records, which are held
        server-side. See our <a href="/privacy">Privacy Policy</a> for how
        those server-side records are handled.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy can be sent to{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </LegalPage>
  );
}
