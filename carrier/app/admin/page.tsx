import { Suspense } from "react";
import type { Metadata } from "next";
import AdminClient from "@/components/AdminClient";
import Backdrop from "@/components/fx/Backdrop";
import { Container } from "@/components/ui";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: `Admin — ${COMPANY.legalName} Order Management`,
  description: `Manage and update ${COMPANY.legalName} order tracking.`,
  // Defense in depth alongside app/robots.ts's disallow rule — robots.txt
  // is a request crawlers can ignore, this is an explicit per-page signal
  // that survives even a direct/indexed link to the login-gated panel.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <div className="relative overflow-hidden">
      <Backdrop variant="soft" />
      {/*
        Marketing-style page header removed (M5). The eyebrow, H1 and
        strapline cost ~200px above the fold on a screen whose entire job
        is a dense table — and they told a logged-in operator nothing they
        didn't already know from having logged in.

        Top padding still clears the fixed site nav.
      */}
      <Container className="relative pt-20 pb-16 md:pt-24 md:pb-24">
        <div>
          <Suspense
            fallback={
              <div className="h-16 rounded-xl border border-hairline bg-surface-1" />
            }
          >
            <AdminClient />
          </Suspense>
        </div>
      </Container>
    </div>
  );
}
