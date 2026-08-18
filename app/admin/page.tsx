import { Suspense } from "react";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import AdminClient from "@/components/AdminClient";
import Backdrop from "@/components/fx/Backdrop";
import { Container, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/motion/primitives";

export const metadata: Metadata = {
  title: "Admin — Dropy Order Management",
  description: "Manage and update Dropy order tracking.",
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
              USA-to-India delivery pipeline.
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
