"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FlaskConical, Lock, Mail, Phone, Search, SearchX, WifiOff } from "lucide-react";
import type { Shipment } from "@/lib/types";
import { COMPANY } from "@/lib/company";
import ShipmentDetail from "./ShipmentDetail";
import { EASE } from "./motion/primitives";
import { Button, cx, IconTile } from "./ui";

const DEMO_HINTS: { id: string; phone: string }[] = [
  { id: "DRP-2026-0421", phone: "9876543210" },
  { id: "DRP-2026-0388", phone: "9988776655" },
  { id: "DRP-2026-0350", phone: "9112233445" },
];

function ResultSkeleton() {
  return (
      <div className="neuro-surface neuro-raised rounded-2xl border border-transparent p-4 sm:p-6 md:p-8">
        <div className="animate-pulse space-y-4 sm:space-y-5">
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3 sm:p-4">
            <div className="size-9 rounded-full bg-surface-3 sm:size-10" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded-xs bg-surface-3 sm:w-40" />
              <div className="h-2.5 w-48 rounded-xs bg-surface-2 sm:w-64" />
            </div>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="h-3 w-28 rounded-xs bg-surface-3 sm:w-32" />
              <div className="h-3 w-40 rounded-xs bg-surface-2 sm:w-48" />
              <div className="mt-2 h-6 w-20 rounded-full bg-surface-3 sm:w-24" />
            </div>
            <div className="h-14 w-24 rounded-xl bg-surface-2 sm:h-16 sm:w-28" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-2.5 w-24 rounded-xs bg-surface-2 sm:w-28" />
              <div className="h-2.5 w-24 rounded-xs bg-surface-2 sm:w-28" />
            </div>
            <div className="h-2 w-full rounded-full bg-surface-3" />
            <div className="flex justify-between">
              <div className="h-2.5 w-16 rounded-xs bg-surface-2 sm:w-20" />
              <div className="h-5 w-20 rounded-full bg-surface-3 sm:w-24" />
              <div className="h-2.5 w-16 rounded-xs bg-surface-2 sm:w-20" />
            </div>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 sm:gap-4">
                <div className="mt-1 size-3 rounded-full bg-surface-3" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-36 rounded-xs bg-surface-3 sm:w-40" />
                  <div className="h-2.5 w-24 rounded-xs bg-surface-2 sm:w-28" />
                </div>
              </div>
          ))}
        </div>
        <span className="sr-only">Searching…</span>
      </div>
  );
}

export default function TrackClient({ isDemo }: { isDemo: boolean }) {
  const params = useSearchParams();
  const initialQuery = params.get("id") ?? "";
  const initialPhone = params.get("phone") ?? "";

  const [input, setInput] = useState(initialQuery);
  const [phone, setPhone] = useState(initialPhone);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Shipment[] | null>(null);
  const [resultSource, setResultSource] = useState<"supabase" | "demo" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const requestId = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (q: string, ph: string) => {
    const trimmed = q.trim();
    const trimmedPhone = ph.trim();
    setQuery(trimmed);

    if (!trimmed || !trimmedPhone) {
      setResults(null);
      setResultSource(null);
      setError(false);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    setError(false);

    try {
      const res = await fetch(`/api/track?q=${encodeURIComponent(trimmed)}&phone=${encodeURIComponent(trimmedPhone)}`);
      if (!res.ok) throw new Error(`Track request failed: ${res.status}`);
      const data = (await res.json()) as { shipments: Shipment[]; source: "supabase" | "demo" };
      if (id !== requestId.current) return;
      setResults(data.shipments ?? []);
      setResultSource(data.source);
    } catch {
      if (id !== requestId.current) return;
      setResults(null);
      setResultSource(null);
      setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery && initialPhone) void runSearch(initialQuery, initialPhone);
  }, [initialQuery, initialPhone, runSearch]);

  useEffect(() => {
    if (!loading && query && (error || results !== null)) {
      resultRef.current?.focus();
    }
  }, [loading]);

  const hasResult = results !== null && results.length > 0;
  const showForm = !loading && !hasResult;

  return (
      <>
        {showForm ? (
            <>
              <div
                  className={cx(
                      "gradient-border relative overflow-hidden rounded-2xl border transition-all duration-300",
                      focused
                          ? "border-primary/30 bg-surface-1 shadow-glow"
                          : "border-hairline bg-surface-1 shadow-lg",
                  )}
              >
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
                />

                <div className="p-3">
                  <div className="relative flex items-center">
                    <div className={cx(
                        "pointer-events-none absolute left-3.5 flex size-8 items-center justify-center rounded-lg transition-colors duration-200",
                        focused === "id" ? "bg-primary/10 text-primary" : "bg-surface-2 text-ink-tertiary",
                    )}>
                      <Search className="size-4" strokeWidth={1.9} />
                    </div>
                    <label htmlFor="tracking-input" className="sr-only">Tracking ID</label>
                    <input
                        id="tracking-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={() => setFocused("id")}
                        onBlur={() => setFocused(null)}
                        placeholder="Order ID — e.g. DRP-2026-0388"
                        spellCheck={false}
                        autoComplete="off"
                        className="min-h-12 w-full rounded-xl bg-transparent pr-4 pl-14 text-body-sm text-ink placeholder:text-ink-tertiary focus:outline-none"
                    />
                  </div>

                  <div className="mx-3 h-px bg-hairline" />

                  <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex flex-1 items-center">
                      <div className={cx(
                          "pointer-events-none absolute left-3.5 flex size-8 items-center justify-center rounded-lg transition-colors duration-200",
                          focused === "phone" ? "bg-primary/10 text-primary" : "bg-surface-2 text-ink-tertiary",
                      )}>
                        <Phone className="size-4" strokeWidth={1.9} />
                      </div>
                      <label htmlFor="phone-input" className="sr-only">Registered phone number</label>
                      <input
                          id="phone-input"
                          type="tel"
                          inputMode="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          onFocus={() => setFocused("phone")}
                          onBlur={() => setFocused(null)}
                          placeholder="Phone — 10 digits"
                          spellCheck={false}
                          autoComplete="off"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void runSearch(input, phone);
                            }
                          }}
                          className="min-h-12 w-full rounded-xl bg-transparent pr-4 pl-14 text-body-sm text-ink placeholder:text-ink-tertiary focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-2 px-1 pb-1 sm:px-0 sm:pb-0 sm:pr-1">
                      <Button
                          type="button"
                          onClick={() => void runSearch(input, phone)}
                          className="flex-1 sm:flex-none sm:min-w-36"
                      >
                        Track order
                      </Button>
                      {query ? (
                          <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                setInput("");
                                setPhone("");
                                void runSearch("", "");
                              }}
                          >
                            Clear
                          </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-3 px-1 text-caption text-ink-tertiary" aria-live="polite">
                {error
                    ? "Something went wrong — try again."
                    : results
                        ? `${results.length} ${results.length === 1 ? "result" : "results"}`
                        : "Enter your Dropy tracking ID and the phone number used at checkout."}
              </p>

              {isDemo ? (
                  <div className="neuro-surface neuro-inset mt-5 rounded-xl border border-transparent p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                      Try a sample order
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {DEMO_HINTS.map((h) => (
                          <button
                              key={h.id}
                              type="button"
                              onClick={() => {
                                setInput(h.id);
                                setPhone(h.phone);
                                void runSearch(h.id, h.phone);
                              }}
                              className="neuro-surface neuro-press group flex items-center gap-2 rounded-lg border border-transparent bg-surface-1 px-3 py-2"
                          >
                            <span className="size-1.5 rounded-full bg-semantic-success" />
                            <span className="font-mono text-[11px] text-ink-subtle group-hover:text-ink">
                              {h.id}
                            </span>
                          </button>
                      ))}
                    </div>
                  </div>
              ) : null}
            </>
        ) : null}

        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {loading
              ? "Searching…"
              : error
                  ? "Something went wrong reaching Dropy. Try again."
                  : hasResult
                      ? `Showing ${results!.length} ${results!.length === 1 ? "result" : "results"} for ${query}.`
                      : results
                          ? `No order found for ${query}.`
                          : ""}
        </div>

        {/* outline-none removes the purple focus ring */}
        <div ref={resultRef} tabIndex={-1} className={cx("outline-none", showForm ? "mt-8" : undefined)}>
          {hasResult ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:mb-5 sm:gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-caption text-ink-tertiary sm:gap-2">
                  <span>Tracking</span>
                  <span className="neuro-well rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-subtle">
                    {query}
                  </span>
                  {resultSource === "demo" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-tertiary">
                        <FlaskConical className="size-2.5" strokeWidth={2} />
                        Demo data
                      </span>
                  ) : null}
                </div>
                <button
                    type="button"
                    onClick={() => {
                      setInput("");
                      setPhone("");
                      void runSearch("", "");
                    }}
                    className="inline-flex min-h-9 shrink-0 items-center rounded-md px-1 text-caption font-medium text-primary transition-colors duration-200 hover:text-primary-hover active:scale-95"
                >
                  Track another order
                </button>
              </div>
          ) : null}

          <AnimatePresence mode="wait">
            {loading ? (
                <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                  <ResultSkeleton />
                </motion.div>
            ) : error ? (
                <motion.div
                    key="error"
                    className="neuro-surface neuro-raised rounded-2xl border border-transparent p-8 text-center sm:p-10"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                >
                  <span className="neuro-surface neuro-dot mx-auto flex size-12 items-center justify-center rounded-2xl text-semantic-alert sm:size-14">
                    <WifiOff className="size-5 sm:size-6" strokeWidth={1.8} />
                  </span>
                  <p className="mt-4 text-body font-semibold text-ink sm:mt-5">Connection error</p>
                  <p className="mx-auto mt-2 max-w-sm text-body-sm text-ink-subtle sm:max-w-md">
                    We couldn&rsquo;t reach Dropy just now. Check your connection and try again.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:mt-6">
                    <Button type="button" onClick={() => void runSearch(input, phone)}>
                      Try again
                    </Button>
                    <a
                        href={`mailto:${COMPANY.email}`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-body-sm text-ink-subtle transition-colors duration-200 hover:text-ink"
                    >
                      <Mail className="size-3.5" strokeWidth={1.8} />
                      Email support
                    </a>
                  </div>
                </motion.div>
            ) : results && results.length > 0 ? (
                <motion.div
                    key={`results-${query}`}
                    className="flex flex-col gap-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                >
                  {results.map((s) => (
                      <ShipmentDetail key={s.id} shipment={s} />
                  ))}
                </motion.div>
            ) : results ? (
                <motion.div
                    key="empty"
                    className="neuro-surface neuro-raised rounded-2xl border border-transparent p-8 text-center sm:p-10"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                >
                  <span className="neuro-surface neuro-dot mx-auto flex size-12 items-center justify-center rounded-2xl text-ink-subtle sm:size-14">
                    <SearchX className="size-5 sm:size-6" strokeWidth={1.8} />
                  </span>
                  <p className="mt-4 text-body font-semibold text-ink sm:mt-5">No order found</p>
                  <p className="mx-auto mt-2 max-w-sm text-body-sm text-ink-subtle sm:max-w-md">
                    No match for{" "}
                    <span className="font-mono text-ink">&ldquo;{query}&rdquo;</span>.
                    Check your tracking ID and the phone number used at checkout —
                    10 digits, no country code or spaces.
                  </p>
                  <a
                      href={`mailto:${COMPANY.email}`}
                      className="neuro-surface neuro-press mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-transparent px-4 text-body-sm text-ink-subtle hover:text-ink sm:mt-6"
                  >
                    <Mail className="size-3.5" strokeWidth={1.8} />
                    Can&rsquo;t find your order? Email support
                  </a>
                </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {showForm ? (
            <div className="neuro-surface neuro-raised mt-10 flex items-start gap-3 rounded-2xl border border-transparent p-4 sm:mt-12 sm:gap-4 sm:p-5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 sm:size-10">
                <Lock className="size-4 sm:size-5" strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-body-sm font-semibold text-ink">
                  Why do we need your phone number?
                </h2>
                <p className="mt-1 max-w-2xl text-caption text-ink-subtle">
                  For your security, we verify your identity using the phone number
                  registered with your order. This prevents unauthorised access to
                  your order details and delivery status.
                </p>
              </div>
            </div>
        ) : null}
      </>
  );
}