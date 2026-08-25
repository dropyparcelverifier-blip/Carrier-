"use client";

import { useState } from "react";
import { Send, User, Mail, MessageSquare } from "lucide-react";
import { COMPANY } from "@/lib/company";
import { Button } from "./ui";

/**
 * No /api/contact route exists — this isn't a gap to fill with a fake
 * endpoint that silently swallows submissions. A mailto: link with the
 * message pre-filled works with zero backend and is honest about where
 * the message actually goes, same pattern as the "Email support" button
 * used everywhere else on the site.
 */
export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);

  const valid = name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && message.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const subject = `Website enquiry from ${name.trim()}`;
    const body = `${message.trim()}\n\n— ${name.trim()} (${email.trim()})`;
    window.location.href = `mailto:${COMPANY.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="contact-name" className="mb-1.5 block text-body-sm font-medium text-ink">
          Name
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-tertiary" strokeWidth={1.9} />
          <input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="neuro-surface neuro-pressed-sm min-h-11 w-full rounded-md border border-transparent pr-3 pl-10 text-body-sm text-ink placeholder:text-ink-tertiary focus:border-primary/40 focus:outline-none"
          />
        </div>
        {touched && !name.trim() ? (
          <p className="mt-1.5 text-caption text-semantic-alert">Enter your name.</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="contact-email" className="mb-1.5 block text-body-sm font-medium text-ink">
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-tertiary" strokeWidth={1.9} />
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="neuro-surface neuro-pressed-sm min-h-11 w-full rounded-md border border-transparent pr-3 pl-10 text-body-sm text-ink placeholder:text-ink-tertiary focus:border-primary/40 focus:outline-none"
          />
        </div>
        {touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? (
          <p className="mt-1.5 text-caption text-semantic-alert">Enter a valid email address.</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-body-sm font-medium text-ink">
          Message
        </label>
        <div className="relative">
          <MessageSquare className="pointer-events-none absolute top-3.5 left-3 size-4 text-ink-tertiary" strokeWidth={1.9} />
          <textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's the order, and what do you need from us?"
            rows={5}
            className="neuro-surface neuro-pressed-sm w-full resize-none rounded-md border border-transparent py-3 pr-3 pl-10 text-body-sm text-ink placeholder:text-ink-tertiary focus:border-primary/40 focus:outline-none"
          />
        </div>
        {touched && !message.trim() ? (
          <p className="mt-1.5 text-caption text-semantic-alert">Enter a message.</p>
        ) : null}
      </div>

      <Button type="submit" size="lg" icon={Send} className="mt-1 w-full sm:w-auto sm:self-start">
        Send message
      </Button>
      <p className="text-caption text-ink-tertiary">
        Opens your email app with this pre-filled — sent straight to {COMPANY.email}.
      </p>
    </form>
  );
}
