"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { Phone, Search } from "lucide-react";
import { Button, cx } from "./ui";
import { EASE } from "./motion/primitives";

const SUGGESTIONS = ["DRP-2026-0421", "DRP-2026-0388", "DRP-2026-0350"];

export default function HeroTrackForm() {
  const router = useRouter();
  const [trackingId, setTrackingId] = useState("");
  const [phone, setPhone] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = () => {
    const tid = trackingId.trim();
    const ph = phone.trim();
    if (!tid || !ph) {
      setError(
        !tid && !ph
          ? "Enter your tracking ID and phone number."
          : !tid
            ? "Enter your tracking ID."
            : "Enter your phone number.",
      );
      return;
    }
    setError(null);
    router.push(`/track?id=${encodeURIComponent(tid)}&phone=${encodeURIComponent(ph)}`);
  };

  return (
    <div className="w-full max-w-xl">
      <div
        className={cx(
          "gradient-border relative flex flex-col gap-2 rounded-xl bg-surface-1/70 p-2 shadow-lg backdrop-blur-md transition-shadow duration-300",
          focused && "shadow-glow",
          error && "animate-[shake_0.4s_ease-in-out]",
        )}
      >
        {/* Tracking ID */}
        <div className="relative flex flex-1 items-center">
          <Search
            className={cx(
              "pointer-events-none absolute left-3 size-4 transition-colors duration-200",
              focused === "id" ? "text-primary" : "text-ink-tertiary",
            )}
            strokeWidth={1.9}
          />
          <label htmlFor="hero-tracking" className="sr-only">Tracking ID</label>
          <input
            id="hero-tracking"
            value={trackingId}
            onChange={(e) => {
              setTrackingId(e.target.value);
              setError(null);
            }}
            onFocus={() => setFocused("id")}
            onBlur={() => setFocused(null)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }}
            placeholder="Order ID or Tracking ID"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!!error && !trackingId.trim()}
            className={cx(
              "min-h-11 w-full rounded-md bg-transparent pr-3 pl-10 text-body-sm text-ink placeholder:text-ink-tertiary focus:outline-none",
              error && !trackingId.trim() && "placeholder:text-semantic-alert/70",
            )}
          />
        </div>

        {/* Phone + Button row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex flex-1 items-center">
            <Phone
              className={cx(
                "pointer-events-none absolute left-3 size-4 transition-colors duration-200",
                focused === "phone" ? "text-primary" : "text-ink-tertiary",
              )}
              strokeWidth={1.9}
            />
            <label htmlFor="hero-phone" className="sr-only">Phone number</label>
            <input
              id="hero-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError(null);
              }}
              onFocus={() => setFocused("phone")}
              onBlur={() => setFocused(null)}
              placeholder="Registered phone number"
              spellCheck={false}
              autoComplete="off"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }}
              aria-invalid={!!error && !phone.trim()}
              className={cx(
                "min-h-11 w-full rounded-md bg-transparent pr-3 pl-10 text-body-sm text-ink placeholder:text-ink-tertiary focus:outline-none",
                error && !phone.trim() && "placeholder:text-semantic-alert/70",
              )}
            />
          </div>
          <Button type="button" onClick={go} className="sm:min-w-28">
            Track
          </Button>
        </div>
      </div>

      {error ? (
        <motion.p
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-caption text-semantic-alert"
        >
          {error}
        </motion.p>
      ) : null}

      <motion.div
        className="mt-3 flex flex-wrap items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5, ease: EASE }}
      >
        <span className="text-caption text-ink-tertiary">Try</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setTrackingId(s);
              // Demo phone numbers
              const phones: Record<string, string> = { "DRP-2026-0421": "9876543210", "DRP-2026-0388": "9988776655", "DRP-2026-0350": "9112233445" };
              setPhone(phones[s] || "");
            }}
            className="min-h-9 rounded-full border border-hairline bg-surface-1/70 px-2.5 py-2 font-mono text-[11px] text-ink-subtle backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-hairline-strong hover:bg-surface-2 hover:text-ink"
          >
            {s}
          </button>
        ))}
      </motion.div>
    </div>
  );
}
