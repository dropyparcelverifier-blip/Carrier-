"use client";

import { useEffect, useState } from "react";
import { STAGES, type StageKey } from "@/lib/types";
import { delayReasonsForStage, type DelayReason } from "@/lib/delay-reasons";
import { courierTrackingUrl } from "@/lib/last-mile";
import StageTimeline from "@/components/admin/StageTimeline";
import AuditTrail from "@/components/admin/AuditTrail";
import type { AdminOrder, AdminOrderItem, AdminOrderEvent } from "@/lib/types";

/**
 * Admin order detail — wireframe A3 (Option C, approved at Gate 5).
 *
 * Single scroll, facts as a real table, full timeline visible without a
 * click, actions pinned to a sticky bar at the bottom.
 *
 * Behaviour carried over from the old EditOrder is catalogued in
 * docs/06-editorder-inventory.md. Anything dropped is a decision recorded
 * there, not an accident.
 */

type Props = {
  order: AdminOrder & {
    clock_anchor_stage?: string | null;
    clock_anchor_at?: string | null;
    label_generated_at?: string | null;
    picked_up_at?: string | null;
    delivered_at?: string | null;
    replacement_of?: string | null;
  };
  canDelete: boolean;
  onSaved: () => void;
  onBack: () => void;
};

export default function OrderDetail({ order, canDelete, onSaved, onBack }: Props) {
  // AdminOrder.current_stage is typed StageKey, but the column also holds
  // the hold states "exception" and "damaged", which sit outside the
  // 0-100% timeline (architecture §5.2). Read through `string` here
  // rather than widening StageKey — narrowing it is what keeps the clock
  // maths honest everywhere else.
  const stage: string = order.current_stage;
  // AdminOrder has created_at, not order_date. The stage clock needs the
  // order's placement time and these are the same instant for admin rows.
  const orderDate: string = (order as { order_date?: string }).order_date ?? order.created_at;
  const [events, setEvents] = useState<AdminOrderEvent[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  // Editable fields — inventory §3
  const [paymentStatus, setPaymentStatus] = useState(order.payment_status || "Unpaid");
  const [shippingDays, setShippingDays] = useState(String(order.shipping_days ?? 10));
  const [adminNotes, setAdminNotes] = useState(order.admin_notes || "");
  const [lastMileCourier, setLastMileCourier] = useState(order.last_mile_courier || "");
  const [lastMileAwb, setLastMileAwb] = useState(order.last_mile_awb || "");

  // Stage move — inventory change (B): NOT pre-filled with the clock's
  // guess. The old screen pre-selected a stage nobody had chosen, so Save
  // silently committed the clock's inference as a human decision. With
  // M3's anchor a manual move is a real recorded event, so it has to be
  // chosen deliberately.
  const [moveTo, setMoveTo] = useState("");
  const [moveAt, setMoveAt] = useState("");
  const [note, setNote] = useState("");

  const reasons = delayReasonsForStage((stage as StageKey) || "order_placed");
  const [delayReason, setDelayReason] = useState<DelayReason>(reasons[0] ?? "Other");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/orders/${order.id}`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) { setError(j.error ?? `Couldn't load event history (${r.status})`); return; }
        setEvents(j.events ?? []);
      })
      .catch(() => setError("Couldn't load event history."));
  }, [order.id]);

  const items: AdminOrderItem[] =
    typeof order.items === "string" ? JSON.parse(order.items) : (order.items || []);

  const trackingUrl = courierTrackingUrl(
    order.last_mile_courier, order.last_mile_awb, order.last_mile_tracking_url,
  );

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/track?id=${encodeURIComponent(order.tracking_id)}&phone=${encodeURIComponent(order.customer_mobile)}`
      : "";

  const copyLink = () => {
    if (!publicUrl) return;
    void navigator.clipboard.writeText(publicUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const call = async (url: string, body: unknown, method = "POST") => {
    setError(""); setSuccess(""); setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? `Request failed (${res.status})`); return false; }
      return true;
    } catch {
      setError("Couldn't reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async () => {
    // Inventory §2.4 — carried over unchanged. A bare "Other" with no
    // explanation tells a customer nothing.
    if (stage === "exception" && delayReason === "Other" && !note.trim()) {
      setError("Add a note explaining the delay, or pick a specific reason.");
      return;
    }
    const ok = await call(`/api/admin/orders/${order.id}`, {
      stage,
      note: stage === "exception"
        ? (note.trim() ? `${delayReason} — ${note.trim()}` : delayReason)  // §2.5
        : note,
      paymentStatus,
      shippingDays: Number(shippingDays) || 10,
      adminNotes,
      orderCreatedAt: order.created_at,
      lastMileCourier: lastMileCourier || undefined,
      lastMileAwb: lastMileAwb.trim() || undefined,
    }, "PATCH");
    if (ok) { setSuccess("Saved."); setTimeout(onSaved, 800); }
  };

  const moveStage = async () => {
    if (!moveTo) { setError("Pick a stage to move to."); return; }
    const ok = await call(`/api/admin/orders/${order.id}/stage`, {
      stage: moveTo,
      happenedAt: moveAt ? new Date(moveAt).toISOString() : undefined,
      note: note.trim() || undefined,
    });
    if (ok) { setSuccess("Stage moved."); setTimeout(onSaved, 800); }
  };

  const setMilestone = async (milestone: "label" | "picked" | "delivered") => {
    const ok = await call(`/api/admin/orders/${order.id}/milestone`, { milestone });
    if (ok) { setSuccess("Recorded."); setTimeout(onSaved, 800); }
  };

  const markDamaged = async () => {
    const ok = await call(`/api/admin/orders/${order.id}/damaged`, {
      note: note.trim() || undefined,
    });
    if (ok) { setSuccess("Marked damaged."); setTimeout(onSaved, 800); }
  };

  const doDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    const ok = await call(`/api/admin/orders/${order.id}`, undefined, "DELETE");
    if (ok) onSaved();
  };

  const currentIdx = STAGES.findIndex((s) => s.key === stage);
  const forwardStages = currentIdx >= 0 ? STAGES.slice(currentIdx + 1) : STAGES;

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="text-body-sm font-semibold text-primary">← Orders</button>
        <span className="font-mono text-body-sm text-ink">{order.tracking_id}</span>
        <span className="text-caption text-ink-subtle">{order.dropy_order_id}</span>
        {order.replacement_of && (
          <span className="rounded-full border border-semantic-warn px-2 py-0.5 text-caption font-semibold uppercase text-semantic-warn">
            Redispatch
          </span>
        )}
        <button
          onClick={copyLink}
          className="ml-auto rounded-full border border-hairline px-3 py-1 text-caption text-ink-subtle hover:border-primary hover:text-primary"
        >
          {linkCopied ? "Link copied" : "Copy tracking link"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-semantic-alert px-4 py-2.5 text-body-sm text-semantic-alert">⚠ {error}</p>
      )}
      {success && (
        <p className="rounded-lg border border-semantic-success px-4 py-2.5 text-body-sm text-semantic-success">{success}</p>
      )}

      {/* Facts — a real table, not cards */}
      <Panel title="Facts">
        <dl className="grid grid-cols-1 sm:grid-cols-2">
          <Fact label="Customer" value={order.customer_name} bold />
          <Fact label="Phone" value={order.customer_mobile} mono />
          <Fact label="City" value={order.customer_city} />
          <Fact label="Mode" value={order.shipping_mode} />
          <Fact label="Payment" value={order.payment_status || "Unpaid"} />
          <Fact label="Shipping days" value={String(order.shipping_days ?? "—")} />
          <Fact label="Ordered" value={new Date(orderDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} />
          <Fact label="ETA" value={order.estimated_delivery || "—"} />
        </dl>
      </Panel>

      {/* Timeline */}
      <Panel title="Stage timeline">
        <StageTimeline
          routeKey={order.route_key ?? null}
          orderDate={orderDate}
          shippingDays={order.shipping_days ?? 10}
          timingSeed={order.timing_seed ?? 0}
          currentStage={stage}
          clockAnchorStage={order.clock_anchor_stage ?? null}
          clockAnchorAt={order.clock_anchor_at ?? null}
          labelGeneratedAt={order.label_generated_at ?? null}
          pickedUpAt={order.picked_up_at ?? null}
          events={events}
        />
      </Panel>

      {/* Milestones — the webhook fallback */}
      <Panel title="Milestones">
        <p className="mb-3 text-caption text-ink-tertiary">
          Normally set by the courier webhook. Record by hand when one doesn&apos;t
          arrive — Velocity has no automatic path yet.
        </p>
        <div className="flex flex-wrap gap-2">
          <MilestoneButton
            label="Label generated" at={order.label_generated_at ?? null}
            onClick={() => setMilestone("label")} disabled={busy}
          />
          <MilestoneButton
            label="Picked up" at={order.picked_up_at ?? null}
            onClick={() => setMilestone("picked")} disabled={busy || !order.label_generated_at}
          />
          <MilestoneButton
            label="Delivered" at={order.delivered_at ?? null}
            onClick={() => setMilestone("delivered")} disabled={busy || !order.picked_up_at}
          />
        </div>
      </Panel>

      {/* Editable details */}
      <Panel title="Details">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Payment status">
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={inputCls}>
              {["Unpaid", "Paid", "Refunded", "COD"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Shipping days">
            <input type="number" min={1} max={30} value={shippingDays}
              onChange={(e) => setShippingDays(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Last-mile courier">
            <select value={lastMileCourier} onChange={(e) => setLastMileCourier(e.target.value)} className={inputCls}>
              <option value="">—</option><option>Shiprocket</option><option>Velocity</option>
            </select>
          </Field>
          <Field label="Last-mile AWB">
            <input value={lastMileAwb} onChange={(e) => setLastMileAwb(e.target.value)}
              placeholder="Optional" className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Admin notes (internal only)">
              <input value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Never shown to the customer" className={inputCls} />
            </Field>
          </div>
          {stage === "exception" && (
            <div className="sm:col-span-2">
              <Field label="Delay reason">
                <select value={delayReason} onChange={(e) => setDelayReason(e.target.value as DelayReason)} className={inputCls}>
                  {reasons.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>
        {trackingUrl && (
          <a href={trackingUrl} target="_blank" rel="noreferrer"
            className="mt-3 inline-block text-caption text-primary underline">
            Open courier tracking ↗
          </a>
        )}
        <button onClick={saveDetails} disabled={busy}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Saving…" : "Save details"}
        </button>
      </Panel>

      {/* Items */}
      <Panel title={`Items (${items.length})`}>
        {items.map((it, i) => (
          <div key={i} className="flex justify-between border-b border-hairline py-2 text-body-sm last:border-0">
            <span className="text-ink">{it.name}</span>
            <span className="whitespace-nowrap text-ink-subtle">×{it.qty} · {it.weight_g}g</span>
          </div>
        ))}
        {!items.length && <p className="py-2 text-caption text-ink-subtle">No items recorded.</p>}
      </Panel>

      {/* Audit */}
      <Panel title="Audit trail">
        <AuditTrail orderId={order.id} />
      </Panel>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline-strong bg-surface-1/95 px-4 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <span className="text-caption font-semibold uppercase text-ink-subtle">Move to</span>
          <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-hairline bg-surface-1 px-2 py-1.5 text-caption">
            <option value="">Select stage…</option>
            {forwardStages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <input type="datetime-local" value={moveAt} onChange={(e) => setMoveAt(e.target.value)}
            className="w-44 rounded-md border border-hairline bg-surface-1 px-2 py-1.5 text-caption" />
          <button onClick={moveStage} disabled={busy || !moveTo}
            className="rounded-md bg-primary px-3 py-1.5 text-caption font-semibold text-white disabled:opacity-40">
            Move
          </button>
          <button onClick={markDamaged} disabled={busy || stage === "damaged"}
            className="rounded-md border border-semantic-alert px-3 py-1.5 text-caption font-semibold text-semantic-alert disabled:opacity-40">
            Damaged
          </button>
          {canDelete && (
            <button onClick={doDelete} disabled={busy}
              className="rounded-md border border-hairline px-3 py-1.5 text-caption text-semantic-alert disabled:opacity-40">
              {confirmDelete ? "Confirm delete?" : "Delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── bits ─── */

const inputCls =
  "w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-body-sm text-ink outline-none focus:border-primary";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-hairline bg-surface-1">
      <header className="border-b border-hairline bg-surface-2 px-4 py-2.5">
        <h3 className="text-caption font-semibold uppercase tracking-wide text-ink-subtle">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Fact({ label, value, mono, bold }: { label: string; value: string | null | undefined; mono?: boolean; bold?: boolean }) {
  return (
    <div className="border-b border-hairline px-1 py-2 last:border-0 sm:odd:border-r sm:odd:pr-4 sm:even:pl-4">
      <dt className="text-caption text-ink-subtle">{label}</dt>
      <dd className={`text-body-sm text-ink ${mono ? "font-mono" : ""} ${bold ? "font-semibold" : ""}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-caption text-ink-subtle">{label}</span>
      {children}
    </label>
  );
}

function MilestoneButton({
  label, at, onClick, disabled,
}: { label: string; at: string | null; onClick: () => void; disabled?: boolean }) {
  if (at) {
    return (
      <span className="rounded-lg border border-semantic-success px-3 py-1.5 text-caption text-semantic-success">
        ✓ {label} — {new Date(at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
      </span>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className="rounded-lg border border-hairline px-3 py-1.5 text-caption text-ink hover:border-primary disabled:opacity-40">
      Record {label.toLowerCase()}
    </button>
  );
}
