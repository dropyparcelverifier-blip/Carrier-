"use client";

import { useEffect, useState } from "react";

/**
 * Per-order audit trail — wireframe A3, POA task 6.7.
 *
 * Shows humans and system actors side by side. The system rows are the
 * point: without them the log has gaps exactly where automation acts, and
 * a tracking ID appears to have come from nowhere.
 */

type Entry = {
  id: string;
  created_at: string;
  actor_type: "user" | "system";
  actor_name: string;
  action: string;
  note: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export default function AuditTrail({ orderId }: { orderId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">("loading");

  useEffect(() => {
    fetch(`/api/admin/audit?order_id=${encodeURIComponent(orderId)}&limit=50`, {
      credentials: "include",
    })
      .then(async (r) => {
        // The audit log is admin-only (M2). Staff get 403, which is not an
        // error worth alarming them about — the panel just isn't for them.
        if (r.status === 403) { setState("denied"); return null; }
        if (!r.ok) { setState("error"); return null; }
        return r.json();
      })
      .then((j) => {
        if (!j) return;
        setEntries(j.entries ?? j.log ?? []);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [orderId]);

  if (state === "denied") return null;

  if (state === "loading") {
    return <p className="px-4 py-6 text-center text-caption text-ink-subtle">Loading history…</p>;
  }
  if (state === "error") {
    return <p className="px-4 py-6 text-center text-caption text-ink-subtle">Couldn&apos;t load history.</p>;
  }
  if (!entries.length) {
    return <p className="px-4 py-6 text-center text-caption text-ink-subtle">No recorded changes yet.</p>;
  }

  return (
    <div className="flex flex-col">
      {entries.map((e, i) => (
        <div
          key={e.id}
          className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 py-2 ${
            i < entries.length - 1 ? "border-b border-hairline" : ""
          }`}
        >
          <span className="shrink-0 font-mono text-caption text-ink-tertiary">
            {new Date(e.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            {" "}
            {new Date(e.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </span>

          <span
            className={`shrink-0 text-caption font-semibold ${
              e.actor_type === "system" ? "text-semantic-info" : "text-ink"
            }`}
            title={e.actor_type === "system" ? "Automated" : "Person"}
          >
            {e.actor_type === "system" ? "⚙ " : "🧑 "}
            {e.actor_name}
          </span>

          <span className="text-caption text-ink-muted">
            {e.note || e.action}
          </span>
        </div>
      ))}
    </div>
  );
}
