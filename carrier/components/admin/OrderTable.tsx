"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SECTIONS, type SectionKey } from "@/lib/order-sections";
import type { AdminOrder } from "@/lib/types";

/**
 * Admin orders table — wireframe A2 (approved at Gate 5).
 *
 * Five sections plus Damaged, six columns, one kebab per row.
 *
 * Every filter, the section split, the counts and the paging happen on
 * the SERVER (see app/api/admin/orders/route.ts). Nothing here slices a
 * local array: at 700-1000 orders/month a client-side filter would only
 * ever search the 25 rows on screen while appearing to search everything.
 *
 * Colours use the existing semantic tokens (--color-semantic-*), applied
 * as text + a tinted border rather than a filled background, because the
 * token set has no -bg variants and inventing hex values here would fork
 * the palette.
 */

type Row = AdminOrder & {
  section: SectionKey | "deleted";
  is_overdue?: boolean;
  /** Clock-derived stage, computed by the API with the same helpers the
   *  customer tracker uses — so both screens agree about one order. The
   *  stored `status` column is stale between admin saves. */
  live_stage?: string;
  live_status?: string;
};

type ApiResponse = {
  orders: Row[];
  counts: Record<string, number>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const SECTION_TONE: Record<SectionKey, string> = {
  transit: "text-semantic-info",
  ready: "text-semantic-warn",
  picked: "text-primary",
  delivered: "text-semantic-success",
  delayed: "text-semantic-alert",
  damaged: "text-semantic-alert",
};

export default function OrderTable({
  onView,
  onEdit,
  canDelete,
}: {
  onView: (o: Row) => void;
  onEdit: (o: Row) => void;
  /**
   * Delete is admin-only. Staff never see the item at all (wireframe A2) —
   * a greyed-out button invites a support question; an absent one doesn't.
   * The server enforces this independently; hiding it is courtesy, not
   * security.
   */
  canDelete: boolean;
}) {
  const [section, setSection] = useState<SectionKey>("transit");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Guards against a slow earlier request landing after a faster later one
  // and painting stale rows — switching tabs quickly is exactly when that
  // happens, and the symptom (wrong rows under the right tab) looks like a
  // backend bug.
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ section, page: String(page) });
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/admin/orders?${params}`, { credentials: "include" });
      const json = await res.json();
      if (seq !== requestSeq.current) return; // superseded by a newer request
      if (!res.ok) {
        setError(json.error ?? "Failed to load orders.");
        return;
      }
      setData(json as ApiResponse);
    } catch {
      if (seq === requestSeq.current) setError("Couldn't reach the server.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [section, page, search]);

  // Debounced so typing a tracking ID doesn't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const counts = data?.counts ?? {};
  const rows = data?.orders ?? [];

  return (
    <div className="flex flex-col gap-4">
      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search tracking ID, order ID, name or phone…"
        className="w-full rounded-lg border border-hairline bg-surface-1 px-4 py-2.5 text-body-sm text-ink outline-none focus:border-primary"
      />

      <div className="flex gap-1 overflow-x-auto border-b border-hairline">
        {SECTIONS.map((s) => {
          const active = s.key === section;
          return (
            <button
              key={s.key}
              onClick={() => { setSection(s.key); setPage(1); }}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-label font-semibold transition-colors ${
                active
                  ? `border-current ${SECTION_TONE[s.key]}`
                  : "border-transparent text-ink-subtle hover:text-ink"
              }`}
            >
              {s.label}
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-caption font-bold">
                {counts[s.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-semantic-alert px-4 py-3 text-body-sm text-semantic-alert">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-hairline">
        <table className="w-full border-collapse text-body-sm">
          <thead>
            <tr className="border-b border-hairline bg-surface-1">
              {["Created", "Order ID", "Name", "Phone", "Status", ""].map((h) => (
                <th
                  key={h || "actions"}
                  className="whitespace-nowrap px-3 py-2.5 text-left text-caption font-semibold uppercase text-ink-subtle"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-subtle">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-ink-subtle">
                  {search ? `No orders match "${search}"` : "No orders in this section"}
                </td>
              </tr>
            )}
            {rows.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                canDelete={canDelete}
                onView={() => onView(o)}
                onEdit={() => onEdit(o)}
                onChanged={load}
              />
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-body-sm text-ink-subtle">
          <span>
            {(data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={data.page <= 1}
              className="rounded-lg border border-hairline px-3 py-1.5 disabled:opacity-40"
            >‹ Prev</button>
            <span>Page {data.page} of {data.totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={data.page >= data.totalPages}
              className="rounded-lg border border-hairline px-3 py-1.5 disabled:opacity-40"
            >Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Row + kebab ─────────────────────────────────── */

function OrderRow({
  order, canDelete, onView, onEdit, onChanged,
}: {
  order: Row; canDelete: boolean;
  onView: () => void; onEdit: () => void; onChanged: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const created = new Date(order.created_at).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const handleDelete = async () => {
    // Two-step: the first click arms it, the second confirms. Delete is
    // recoverable now (soft delete) but it still pulls an order out of
    // every view, and a kebab item is an easy mis-tap.
    if (!confirming) { setConfirming(true); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) onChanged();
    } finally {
      setBusy(false);
      setMenuOpen(false);
      setConfirming(false);
    }
  };

  return (
    <tr className="border-b border-hairline last:border-0 hover:bg-surface-1">
      <td className="whitespace-nowrap px-3 py-3 text-ink-subtle">{created}</td>
      <td className="px-3 py-3 font-mono text-caption text-ink">{order.tracking_id}</td>
      <td className="px-3 py-3 font-medium text-ink">{order.customer_name}</td>
      <td className="px-3 py-3 font-mono text-caption text-ink-subtle">{order.customer_mobile}</td>
      <td className="px-3 py-3"><StatusCell order={order} /></td>
      <td className="relative w-11 px-3 py-3">
        <button
          onClick={() => { setMenuOpen((v) => !v); setConfirming(false); }}
          aria-label="Actions"
          className="rounded-md border border-hairline px-2 py-1 leading-none text-ink-subtle hover:text-ink"
        >⋮</button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => { setMenuOpen(false); setConfirming(false); }}
            />
            <div className="absolute right-3 top-full z-50 mt-1 min-w-36 overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-lg">
              <MenuItem onClick={() => { setMenuOpen(false); onView(); }}>View</MenuItem>
              <MenuItem onClick={() => { setMenuOpen(false); onEdit(); }}>Edit</MenuItem>
              {canDelete && (
                <MenuItem danger onClick={handleDelete} disabled={busy}>
                  {busy ? "Deleting…" : confirming ? "Confirm delete?" : "Delete"}
                </MenuItem>
              )}
            </div>
          </>
        )}
      </td>
    </tr>
  );
}

function MenuItem({
  children, onClick, danger, disabled,
}: {
  children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`block w-full border-b border-hairline px-3.5 py-2.5 text-left text-body-sm last:border-0 hover:bg-surface-2 disabled:opacity-50 ${
        danger ? "text-semantic-alert" : "text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function StatusCell({ order }: { order: Row }) {
  const label =
    order.section === "damaged" ? "Damaged"
    : order.section === "delivered" ? "Delivered"
    : order.section === "picked" ? "Picked up"
    : order.section === "ready" ? "Ready to pick"
    : order.is_overdue ? "Delayed"
    // live_status, not status — the stored column is stale between saves.
    : (order.live_status ?? order.status);

  const tone =
    order.section === "damaged" || order.section === "delayed"
      ? "border-semantic-alert text-semantic-alert"
      : order.section === "delivered"
        ? "border-semantic-success text-semantic-success"
        : order.section === "ready"
          ? "border-semantic-warn text-semantic-warn"
          : "border-semantic-info text-semantic-info";

  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-caption font-semibold uppercase ${tone}`}>
      {label}
    </span>
  );
}
