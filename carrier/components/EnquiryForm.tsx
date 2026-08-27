"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { COMPANY } from "@/lib/company";

/**
 * Business enquiry form.
 *
 * The disclosure below the submit button is NOT boilerplate. Enquiries
 * are shared with the carrier partner as part of the data agreement, and
 * someone handing over their name, phone and business has to be told that
 * before they hit send, not after. It's one sentence and it belongs on
 * the form itself rather than only in the privacy policy.
 */

const FIELDS = {
  business_name: "", business_desc: "", contact_name: "",
  email: "", phone: "", subject: "", body: "",
};

export default function EnquiryForm() {
  const [f, setF] = useState({ ...FIELDS });
  const [website, setWebsite] = useState("");   // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof FIELDS) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const valid =
    f.business_name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()) &&
    f.subject.trim().length >= 3 &&
    f.body.trim().length >= 20;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, website }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "Couldn't send that."); return; }
      setSent(true);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-hairline bg-surface-1 p-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-semantic-success/12">
          <Check className="size-5 text-semantic-success" strokeWidth={2.4} />
        </span>
        <h3 className="mt-4 font-display text-card-title font-semibold text-ink">
          We&apos;ve got it
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-body-sm text-ink-subtle">
          We answer within four business hours. If it&apos;s urgent, the phone
          number is at the bottom of this page.
        </p>
        <button
          onClick={() => { setF({ ...FIELDS }); setSent(false); }}
          className="mt-5 text-body-sm font-medium text-primary hover:text-primary-hover"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Business name" required>
          <input className={inp} value={f.business_name} onChange={set("business_name")}
                 placeholder="Your company" autoComplete="organization" />
        </Field>
        <Field label="Your name">
          <input className={inp} value={f.contact_name} onChange={set("contact_name")}
                 autoComplete="name" />
        </Field>
        <Field label="Email" required>
          <input className={inp} type="email" value={f.email} onChange={set("email")}
                 autoComplete="email" />
        </Field>
        <Field label="Phone">
          <input className={inp} type="tel" value={f.phone} onChange={set("phone")}
                 autoComplete="tel" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="What does your business do?"
                 hint="A line is plenty — it helps us route you to the right lane.">
            <input className={inp} value={f.business_desc} onChange={set("business_desc")}
                   placeholder="e.g. we distribute personal care across west India" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Subject" required>
            <input className={inp} value={f.subject} onChange={set("subject")}
                   placeholder="What's this about?" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Your enquiry" required
                 hint="What are you moving, from where, and how often?">
            <textarea className={`${inp} min-h-32 resize-y`} value={f.body} onChange={set("body")} />
          </Field>
        </div>
      </div>

      {/* Honeypot — hidden from people, filled in by most bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website}
                 onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-semantic-alert px-4 py-3 text-body-sm text-semantic-alert">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={!valid || busy}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-button font-medium text-white transition-all duration-200 hover:-translate-y-px hover:bg-primary-hover disabled:cursor-default disabled:opacity-40 disabled:hover:translate-y-0"
      >
        {busy ? "Sending…" : "Send enquiry"}
        {!busy && <ArrowRight className="size-4" strokeWidth={2} />}
      </button>

      <p className="mt-4 text-caption leading-relaxed text-ink-tertiary">
        Your enquiry is shared internally with the teams who quote and route
        the lane you&apos;re asking about. We don&apos;t sell your details or add
        you to a mailing list.{" "}
        <a href="/privacy" className="underline hover:text-ink-subtle">Privacy policy</a>.
      </p>
    </div>
  );
}

const inp =
  "w-full rounded-lg border border-hairline bg-surface-2 px-3.5 py-2.5 text-body-sm text-ink " +
  "outline-none transition-colors placeholder:text-ink-tertiary focus:border-primary";

function Field({
  label, children, required, hint,
}: {
  label: string; children: React.ReactNode; required?: boolean; hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption font-medium text-ink-muted">
        {label}
        {required && <span className="ml-0.5 text-semantic-alert">*</span>}
      </span>
      {children}
      {hint && <span className="text-caption text-ink-tertiary">{hint}</span>}
    </label>
  );
}
