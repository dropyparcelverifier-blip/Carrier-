import { Suspense } from "react";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import AdminClient from "@/components/AdminClient";
import Backdrop from "@/components/fx/Backdrop";
import { Container, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/motion/primitives";
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
      <Container className="relative pt-24 pb-16 md:pt-32 md:pb-24">
        <Reveal>
          <div className="flex flex-col items-start gap-2">
            <Eyebrow icon={ShieldCheck}>Admin panel</Eyebrow>
            <h1 className="mt-2 max-w-2xl font-display text-[clamp(24px,4vw,36px)] leading-[1.1] font-semibold tracking-[-0.03em] text-ink text-balance">
              Order management
            </h1>
            <p className="max-w-xl text-body-sm text-ink-subtle">
              Create orders, update shipping stages, and manage the
              global-to-India delivery pipeline.
            </p>
          </div>
        </Reveal>

        <div className="mt-7">
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
