"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  Check,
  Clock,
  CreditCard,
  Lock,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  Zap,
} from "lucide-react";
import { STAGES, suggestStage, type AdminOrder, type AdminOrderEvent, type AdminOrderItem, type StageKey } from "@/lib/types";
import { STAGE_PROGRESS, PAYMENT_STATUSES } from "@/lib/admin-stages";
import { DELAY_PROFILES, delayReasonsForStage, resolveByEstimate, type DelayReason } from "@/lib/delay-reasons";
import { LAST_MILE_COURIERS, courierTrackingUrl } from "@/lib/last-mile";
import { COMPANY } from "@/lib/company";
import { Button, cx } from "./ui";

type Order = AdminOrder;

/* ── ID generators ── */
function genUSId() {
  const p1 = String(Math.floor(100 + Math.random() * 900));
  const p2 = String(Math.floor(1000000 + Math.random() * 9000000));
  const p3 = String(Math.floor(1000000 + Math.random() * 9000000));
  return `${p1}-${p2}-${p3}`;
}

let dropyCounter = 1000;
function genDropyId() {
  dropyCounter++;
  return `DROPY-${dropyCounter}`;
}

function genTrackingId() {
  return `TRK${Date.now().toString(36).toUpperCase()}${String(Math.floor(Math.random() * 99)).padStart(2, "0")}`;
}

/* ══════════════════════════════════════════════════════════════ */
export default function AdminClient() {
  // null = session not checked yet, true/false once we know.
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [orders, setOrders] = useState<Order[]>([]);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    // FIX: credentials:"include" so the session cookie is sent when
    // accessing the admin panel via Tailscale IP (100.87.0.22) instead
    // of localhost — fetch omits cookies on cross-origin requests by default.
    const res = await fetch("/api/admin/orders", { credentials: "include" });
    if (res.status === 401) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    const json = await res.json();
    setAuthed(true);
    // A non-401 failure (Supabase not configured, a DB error, ...) still
    // means the session is valid — it just couldn't load orders. Surface
    // that instead of silently showing an empty "no orders yet" list,
    // which reads as "this account genuinely has zero orders."
    if (!res.ok) {
      setOrders([]);
      setLoadError(json.error ?? `Failed to load orders (${res.status})`);
      setLoading(false);
      return;
    }
    const data: Order[] = json.orders ?? [];
    setOrders(data);
    // Get max dropy counter
    if (data.length) {
      const maxNum = Math.max(...data.map((o) => {
        const m = o.dropy_order_id?.match(/DROPY-(\d+)/);
        return m ? parseInt(m[1]) : 0;
      }));
      if (maxNum > dropyCounter) dropyCounter = maxNum;
    }
    setLoading(false);
  }, []);

  // A valid session cookie survives a page reload even though local
  // `authed` state doesn't — check the real session on mount instead of
  // always bouncing back to the login screen.
  useEffect(() => { reload(); }, [reload]);

  const logout = async () => {
    // FIX: credentials:"include"
    await fetch("/api/admin-logout", { method: "POST", credentials: "include" });
    setAuthed(false);
    setOrders([]);
  };

  if (authed === null) {
    return <div className="p-12 text-center text-ink-tertiary animate-pulse">Loading…</div>;
  }
  if (!authed) return <LoginGate onLogin={reload} />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h2 className="flex items-center gap-2 font-display text-subhead text-ink">
          {view === "list"   && <><Package className="size-5 text-primary" strokeWidth={1.8} /> Orders</>}
          {view === "create" && <><Plus    className="size-5 text-primary" strokeWidth={1.8} /> New Order</>}
          {view === "edit"   && <><Pencil  className="size-5 text-primary" strokeWidth={1.8} /> Manage Order</>}
        </h2>
        <div className="flex gap-2">
          {view !== "list" && (
            <Button variant="secondary" onClick={() => { setView("list"); setEditOrder(null); }}>
              <ArrowLeft className="size-3.5" /> Back
            </Button>
          )}
          {view === "list" && (
            <>
              <Button variant="secondary" onClick={reload}><RefreshCw className="size-3.5" /> Refresh</Button>
              <Button onClick={() => setView("create")}><Plus className="size-3.5" /> New Order</Button>
              <Button variant="secondary" onClick={logout}><Lock className="size-3.5" /> Log out</Button>
            </>
          )}
        </div>
      </div>

      {loadError && view === "list" ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-semantic-alert/30 bg-semantic-alert/8 px-4 py-3">
          <p className="text-body-sm text-semantic-alert">⚠ {loadError}</p>
          <Button variant="secondary" size="sm" onClick={reload}>Retry</Button>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {view === "list" && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <OrderList orders={orders} loading={loading} onEdit={(o) => { setEditOrder(o); setView("edit"); }} onRefresh={reload} />
          </motion.div>
        )}
        {view === "create" && (
          <motion.div key="create" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <CreateOrder onSave={() => { reload(); setView("list"); }} />
          </motion.div>
        )}
        {view === "edit" && editOrder && (
          <motion.div key="edit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <EditOrder order={editOrder} onSave={() => { reload(); setView("list"); setEditOrder(null); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Login ── */
function LoginGate({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user.trim() || !pass) { setError("Enter username and password"); return; }
    setBusy(true); setError("");
    try {
      // FIX: credentials:"include"
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.trim(), password: pass }),
        credentials: "include",
      });
      const json = await res.json();
      if (json.ok) onLogin(); else setError(json.error ?? "Invalid credentials");
    } catch { setError("Connection error"); }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-sm">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="gradient-border rounded-xl bg-surface-1 p-8 shadow-lg">
        <div className="flex flex-col items-center gap-2 mb-6">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Lock className="size-5" strokeWidth={1.9} />
          </span>
          <h2 className="font-display text-headline text-ink">Admin login</h2>
          <p className="text-caption text-ink-tertiary">{COMPANY.legalName} Order Management</p>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); submit(); }}
          className="flex flex-col gap-4"
        >
          <Input label="Username" value={user} onChange={setUser} placeholder="admin" />
          <Input label="Password" value={pass} onChange={setPass} placeholder="••••••••" type="password" />
          {error && <p className="text-caption text-semantic-alert text-center">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Verifying…" : "Sign in"}</Button>
        </form>
      </motion.div>
    </div>
  );
}

/* ── Order List ── */
const PAGE_SIZE = 20;
const STAGE_FILTERS = [{ value: "", label: "All stages" }, ...STAGES.map(s => ({ value: s.key, label: s.label }))];
const PAYMENT_FILTERS = [{ value: "", label: "All payments" }, ...PAYMENT_STATUSES.map(p => ({ value: p, label: p }))];

// Real orders only ever ship Air Freight or Express Air (Ocean Freight is
// rejected at creation — see lib/create-order.ts) — the filter only offers
// modes an order could actually have, not the full ShipmentMode union.
const MODE_FILTERS = ["", "Air Freight", "Express Air"] as const;

function OrderList({ orders, loading, onEdit, onRefresh }: {
  orders: Order[]; loading: boolean; onEdit: (o: Order) => void; onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  // Separate from stageFilter (not just "exception" as one more dropdown
  // value) — a dedicated toggle reads as "show me what needs attention"
  // at a glance, and stays usable alongside a stage filter for someone who
  // wants "exceptions currently sitting at indian_customs" specifically.
  const [exceptionOnly, setExceptionOnly] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // Populated from whatever cities actually appear in the current order
  // set, not a hardcoded list — a free-text filter would require typing
  // an exact match, and this data is small enough to just offer as a
  // dropdown of real options.
  const cityOptions = Array.from(new Set(orders.map(o => o.customer_city).filter((c): c is string => Boolean(c)))).sort();

  const filtered = orders.filter(o => {
    const createdAt = new Date(o.created_at);
    return (
      (!stageFilter || o.current_stage === stageFilter) &&
      (!paymentFilter || (o.payment_status || "Unpaid") === paymentFilter) &&
      // current_stage is typed StageKey, but the DB (and the admin PATCH
      // route) also stores the literal "exception" for a delayed order —
      // see lib/types.ts's own note that StageKey covers the 13 real
      // stages, not this out-of-band hold state. Cast through `string`
      // rather than widening StageKey itself, matching how the existing
      // delay UI below (reasonsForCurrentStage) already works around it.
      (!exceptionOnly || (o.current_stage as string) === "exception") &&
      (!cityFilter || o.customer_city === cityFilter) &&
      (!modeFilter || o.shipping_mode === modeFilter) &&
      (!dateFrom || createdAt >= new Date(dateFrom)) &&
      // End-of-day on dateTo — a bare date parses to 00:00, which would
      // exclude every order actually placed ON that day.
      (!dateTo || createdAt <= new Date(`${dateTo}T23:59:59.999`)) &&
      [o.tracking_id, o.dropy_order_id, o.us_order_id, o.customer_name, o.customer_mobile]
        .some(v => v?.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const hasActiveFilters = Boolean(
    search || stageFilter || paymentFilter || exceptionOnly || cityFilter || modeFilter || dateFrom || dateTo,
  );

  // Any filter/search change invalidates the current page — jumping back
  // to page 3 of a now-5-result list would just show an empty page.
  const resetPage = () => setPage(1);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const paged = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const counts = {
    total: orders.length,
    transit: orders.filter(o => !["order_placed", "qc_check"].includes(o.current_stage)).length,
    received: orders.filter(o => o.current_stage === "qc_check").length,
    exception: orders.filter(o => (o.current_stage as string) === "exception").length,
  };

  function clearAllFilters() {
    setSearch(""); setStageFilter(""); setPaymentFilter(""); setExceptionOnly(false);
    setCityFilter(""); setModeFilter(""); setDateFrom(""); setDateTo("");
    resetPage();
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 mb-6 sm:grid-cols-4 sm:gap-3">
        {([
          ["Total", counts.total, "text-primary"],
          ["In transit", counts.transit, "text-semantic-warn"],
          ["Approved", counts.received, "text-semantic-success"],
          ["Exceptions", counts.exception, "text-semantic-alert"],
        ] as const).map(([label, val, color]) => (
          <div key={label} className="rounded-lg border border-hairline bg-surface-1 px-3 py-3 transition-shadow hover:shadow-md sm:px-5 sm:py-4">
            <p className="text-[11px] text-ink-tertiary sm:text-caption">{label}</p>
            <p className={cx("mt-1 font-display text-body-lg sm:text-headline", color)}>{val}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 mb-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-tertiary" strokeWidth={1.9} />
          <input value={search} onChange={e => { setSearch(e.target.value); resetPage(); }}
            placeholder={`Search by US ID, ${COMPANY.legalName} ID, Tracking ID, name, or phone…`}
            className="w-full rounded-lg border border-hairline bg-surface-1 py-2.5 pl-10 pr-4 text-body-sm text-ink placeholder:text-ink-tertiary focus:border-primary focus:outline-none transition-colors" />
        </div>
        <button
          type="button"
          onClick={() => { setExceptionOnly(v => !v); resetPage(); }}
          aria-pressed={exceptionOnly}
          className={cx(
            "flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2.5 text-body-sm font-medium transition-colors",
            exceptionOnly
              ? "border-semantic-alert/40 bg-semantic-alert/12 text-semantic-alert"
              : "border-hairline bg-surface-1 text-ink-subtle hover:border-hairline-strong",
          )}
        >
          <AlertTriangle className="size-4" strokeWidth={1.9} />
          Exceptions only
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={stageFilter} onChange={e => { setStageFilter(e.target.value); resetPage(); }}
          className="rounded-lg border border-hairline bg-surface-1 px-3 py-2.5 text-body-sm text-ink focus:border-primary focus:outline-none transition-colors">
          {STAGE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); resetPage(); }}
          className="rounded-lg border border-hairline bg-surface-1 px-3 py-2.5 text-body-sm text-ink focus:border-primary focus:outline-none transition-colors">
          {PAYMENT_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={modeFilter} onChange={e => { setModeFilter(e.target.value); resetPage(); }}
          className="rounded-lg border border-hairline bg-surface-1 px-3 py-2.5 text-body-sm text-ink focus:border-primary focus:outline-none transition-colors">
          {MODE_FILTERS.map(m => <option key={m} value={m}>{m || "All modes"}</option>)}
        </select>
        {cityOptions.length > 0 && (
          <select value={cityFilter} onChange={e => { setCityFilter(e.target.value); resetPage(); }}
            className="rounded-lg border border-hairline bg-surface-1 px-3 py-2.5 text-body-sm text-ink focus:border-primary focus:outline-none transition-colors">
            <option value="">All cities</option>
            {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="admin-date-from">Placed from</label>
          <input id="admin-date-from" type="date" value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); resetPage(); }}
            className="rounded-lg border border-hairline bg-surface-1 px-3 py-2.5 text-body-sm text-ink focus:border-primary focus:outline-none transition-colors" />
          <span className="text-caption text-ink-tertiary">to</span>
          <label className="sr-only" htmlFor="admin-date-to">Placed to</label>
          <input id="admin-date-to" type="date" value={dateTo}
            onChange={e => { setDateTo(e.target.value); resetPage(); }}
            className="rounded-lg border border-hairline bg-surface-1 px-3 py-2.5 text-body-sm text-ink focus:border-primary focus:outline-none transition-colors" />
        </div>
        {hasActiveFilters && (
          <button type="button" onClick={clearAllFilters}
            className="rounded-lg border border-hairline bg-surface-1 px-3 py-2.5 text-body-sm text-ink-subtle transition-colors hover:border-hairline-strong hover:text-ink">
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-hairline bg-surface-1 p-12 text-center text-ink-tertiary animate-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface-1 p-12 text-center text-ink-tertiary">
          {hasActiveFilters ? "No matching orders." : "No orders yet — create your first one."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {paged.map(o => {
            const stage = STAGES.find(s => s.key === o.current_stage);
            const isFinal = o.current_stage === "qc_check";
            const payment = o.payment_status || "Unpaid";
            return (
              <button key={o.id} onClick={() => onEdit(o)}
                className="group flex items-center gap-4 rounded-lg border border-hairline bg-surface-1 px-5 py-4 text-left transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-body-sm text-ink">{o.tracking_id}</span>
                    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      isFinal ? "bg-semantic-success/12 text-semantic-success" :
                      o.current_stage === "order_placed" ? "bg-surface-3 text-ink-subtle" :
                      "bg-primary/12 text-primary-hover")}>
                      <span className={cx("size-1.5 rounded-full", isFinal ? "bg-semantic-success" : o.current_stage === "order_placed" ? "bg-ink-subtle" : "bg-primary")} />
                      {stage?.short ?? o.current_stage}
                    </span>
                    <PaymentBadge status={payment} />
                  </div>
                  <p className="mt-1 text-caption text-ink-subtle truncate">
                    {o.customer_name} · {o.customer_mobile} · {o.customer_city || "—"}
                  </p>
                  {o.us_order_id && <p className="text-[11px] text-ink-tertiary mt-0.5 font-mono">US: {o.us_order_id}</p>}
                </div>
                <div className="hidden sm:block text-right shrink-0">
                  <p className="text-caption text-ink-tertiary">{o.dropy_order_id}</p>
                  <p className="text-[11px] text-ink-tertiary mt-0.5">
                    {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <Pencil className="size-4 text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.8} />
              </button>
            );
          })}

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-caption text-ink-tertiary">
                {(clampedPage - 1) * PAGE_SIZE + 1}–{Math.min(clampedPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={clampedPage <= 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={clampedPage >= pageCount} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ── Create Order ── */
function CreateOrder({ onSave }: { onSave: () => void }) {
  const [form, setForm] = useState({
    us_order_id: genUSId(), dropy_order_id: genDropyId(), tracking_id: genTrackingId(),
    customer_name: "", customer_mobile: "", customer_email: "",
    customer_address: "", customer_city: "Mumbai", customer_pincode: "",
    shipping_days: "10", shipping_mode: "Air Freight",
    carrier_name: "DotConnects Logistics", awb_number: "", admin_notes: "",
    payment_status: "Unpaid",
  });
  const [items, setItems] = useState([{ name: "", qty: "1", weight_g: "100", sku: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const validate = (): string | null => {
    if (!form.customer_name.trim()) return "Customer name is required.";
    if (!/^\d{10}$/.test(form.customer_mobile.trim())) return "Mobile must be exactly 10 digits.";
    if (form.customer_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email.trim())) {
      return "Enter a valid email address.";
    }
    if (!form.customer_city.trim()) return "City is required.";
    if (form.customer_pincode.trim() && !/^\d{6}$/.test(form.customer_pincode.trim())) {
      return "Pincode must be exactly 6 digits.";
    }
    if (!items.some(it => it.name.trim())) return "Add at least one item with a name.";
    for (const it of items) {
      if (!it.name.trim()) continue;
      const qty = Number(it.qty);
      if (!Number.isFinite(qty) || qty < 1) return `"${it.name.trim()}" needs a quantity of at least 1.`;
      const weight = Number(it.weight_g);
      if (!Number.isFinite(weight) || weight <= 0) return `"${it.name.trim()}" needs a weight greater than 0.`;
    }
    if (!/^\d{3}-\d{7}-\d{7}$/.test(form.us_order_id.trim())) return "US Order ID must be in format: 333-7777777-7777777";
    const days = Number(form.shipping_days);
    if (!days || days < 1 || days > 30) return "Shipping days must be between 1 and 30.";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError("");

    // FIX: credentials:"include"
    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, shipping_days: Number(form.shipping_days), items }),
      credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed to create order"); setSaving(false); return; }
    onSave();
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Customer details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Customer name *" value={form.customer_name} onChange={v => set("customer_name", v)} />
          <Input label="Mobile number *" value={form.customer_mobile} onChange={v => set("customer_mobile", v)} placeholder="10 digits" />
          <Input label="Email" value={form.customer_email} onChange={v => set("customer_email", v)} />
          <Input label="City *" value={form.customer_city} onChange={v => set("customer_city", v)} />
          <Input label="Address" value={form.customer_address} onChange={v => set("customer_address", v)} />
          <Input label="Pincode" value={form.customer_pincode} onChange={v => set("customer_pincode", v)} />
        </div>
      </Section>

      <Section title="Order identifiers">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="US Order ID *" value={form.us_order_id} onChange={v => set("us_order_id", v)} placeholder="333-7777777-7777777" />
          <div>
            <Input label={`${COMPANY.legalName} ID`} value={form.dropy_order_id} onChange={v => set("dropy_order_id", v)} />
            <p className="text-[11px] text-ink-tertiary mt-1">Auto: DROPY-1234</p>
          </div>
          <div>
            <Input label="Tracking ID" value={form.tracking_id} onChange={v => set("tracking_id", v)} />
            <p className="text-[11px] text-ink-tertiary mt-1">Auto-generated for website</p>
          </div>
        </div>
      </Section>

      <Section title="Items">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-2 gap-3 mb-3 items-end rounded-lg border border-hairline-tertiary p-3 sm:grid-cols-[2fr_0.7fr_0.8fr_1fr_auto] sm:border-0 sm:p-0">
            <div className="col-span-2 sm:col-span-1">
              <Input label={i === 0 ? "Item name *" : undefined} value={item.name}
                onChange={v => { const n = [...items]; n[i].name = v; setItems(n); }} placeholder="Product name" />
            </div>
            <Input label={i === 0 ? "Qty" : undefined} value={item.qty}
              onChange={v => { const n = [...items]; n[i].qty = v; setItems(n); }} type="number" />
            <Input label={i === 0 ? "Weight (g)" : undefined} value={item.weight_g}
              onChange={v => { const n = [...items]; n[i].weight_g = v; setItems(n); }} type="number" />
            <Input label={i === 0 ? "SKU" : undefined} value={item.sku}
              onChange={v => { const n = [...items]; n[i].sku = v; setItems(n); }} placeholder="Optional" />
            <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
              aria-label="Remove item"
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-2 text-ink-tertiary hover:border-semantic-alert/40 hover:text-semantic-alert active:scale-[0.97] transition-all sm:size-9 sm:mb-0.5">
              <Trash2 className="size-3.5" strokeWidth={1.8} />
              <span className="text-body-sm sm:hidden">Remove</span>
            </button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setItems(p => [...p, { name: "", qty: "1", weight_g: "100", sku: "" }])}>
          <Plus className="size-3.5" /> Add item
        </Button>
      </Section>

      <Section title="Shipping & payment">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Input label="Shipping days *" value={form.shipping_days} onChange={v => set("shipping_days", v)} type="number" />
            <p className="text-[11px] text-ink-tertiary mt-1">Working days USA → Vashi</p>
          </div>
          <div>
            {/* Ocean Freight isn't a real service today — every order ships
                air. The route/schema/validation support for it stays in
                place (lib/routes.ts OCEAN_MODES) so it's a quick flip to
                re-enable if the business adds sea freight later, but it's
                deliberately not offered here to avoid creating orders on a
                lane we don't actually run. */}
            <SelectInput label="Shipping mode" value={form.shipping_mode} onChange={v => set("shipping_mode", v)}
              options={["Air Freight", "Express Air"]} />
          </div>
          <SelectInput label="Payment status" value={form.payment_status} onChange={v => set("payment_status", v)}
            options={[...PAYMENT_STATUSES]} />
          <Input label="AWB number" value={form.awb_number} onChange={v => set("awb_number", v)} placeholder="Optional" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
          <Input label="Carrier" value={form.carrier_name} onChange={v => set("carrier_name", v)} />
          <Input label="Admin notes" value={form.admin_notes} onChange={v => set("admin_notes", v)} placeholder="Internal notes" />
        </div>
      </Section>

      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-md border border-semantic-alert/30 bg-semantic-alert/8 px-4 py-2.5 text-body-sm text-semantic-alert">
          ⚠ {error}
        </motion.p>
      )}
      <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
        {saving ? "Creating…" : "Create order"}
      </Button>
    </div>
  );
}

/* ── Edit Order ── */
function EditOrder({ order, onSave }: { order: Order; onSave: () => void }) {
  const suggested = suggestStage(order.created_at, order.shipping_days ?? 10);

  const [stage, setStage] = useState<string>(suggested);
  const [note, setNote] = useState("");
  // Reasons offered are only the ones that make sense for wherever this
  // order actually sits right now (see lib/delay-reasons.ts) — e.g.
  // "Customs hold" isn't offered for an order still at the US warehouse.
  const reasonsForCurrentStage = delayReasonsForStage((order.current_stage as StageKey) ?? "order_placed");
  const [delayReason, setDelayReason] = useState<DelayReason>(reasonsForCurrentStage[0] ?? "Other");
  const [paymentStatus, setPaymentStatus] = useState(order.payment_status || "Unpaid");
  const [shippingDays, setShippingDays] = useState(String(order.shipping_days ?? 10));
  const [adminNotes, setAdminNotes] = useState(order.admin_notes || "");
  const [lastMileCourier, setLastMileCourier] = useState(order.last_mile_courier || "");
  const [lastMileAwb, setLastMileAwb] = useState(order.last_mile_awb || "");
  const [events, setEvents] = useState<AdminOrderEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const autoSuggested = suggested !== order.current_stage;

  useEffect(() => {
    (async () => {
      // FIX: credentials:"include"
      const res = await fetch(`/api/admin/orders/${order.id}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Couldn't load event history (${res.status})`);
        return;
      }
      setEvents(json.events ?? []);
    })();
  }, [order.id]);

  const handleUpdate = async () => {
    setError("");
    // A delay reason with no further detail ("Other" with nothing typed) is
    // useless to a customer reading the tracking page — require either a
    // specific reason or an explanation in the note.
    if (stage === "exception" && delayReason === "Other" && !note.trim()) {
      setError("Add a note explaining the delay, or pick a specific reason.");
      return;
    }
    setSaving(true); setSuccess("");

    const effectiveNote = stage === "exception"
      ? (note.trim() ? `${delayReason} — ${note.trim()}` : delayReason)
      : note;

    // FIX: credentials:"include"
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage, note: effectiveNote, paymentStatus,
        shippingDays: Number(shippingDays) || 10,
        adminNotes,
        orderCreatedAt: order.created_at,
        lastMileCourier: lastMileCourier || undefined,
        lastMileAwb: lastMileAwb.trim() || undefined,
      }),
      credentials: "include",
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed to update order"); setSaving(false); return; }

    setSuccess("Order updated successfully");
    setTimeout(() => onSave(), 800);
  };

  const handleDelete = async () => {
    if (!confirmingDelete) { setConfirmingDelete(true); return; }
    setDeleting(true);
    // FIX: credentials:"include"
    const res = await fetch(`/api/admin/orders/${order.id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { setDeleting(false); setConfirmingDelete(false); return; }
    onSave();
  };

  const items: AdminOrderItem[] = typeof order.items === "string" ? JSON.parse(order.items) : (order.items || []);
  // handed_to_courier is the real final stage now — qc_check still needs
  // the update form open so the courier/AWB fields below can be filled in
  // (which is itself what advances the order past qc_check; see the PATCH
  // route's stageForUpdate logic).
  const isFinal = order.current_stage === "handed_to_courier";
  const awaitingHandover = order.current_stage === "qc_check";
  const trackingUrl = courierTrackingUrl(order.last_mile_courier);

  return (
    <div className="flex flex-col gap-6">
      {/* Order summary */}
      <div className="gradient-border rounded-xl bg-surface-1 p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-caption text-ink-tertiary">Tracking ID</p>
            <p className="mt-1 font-mono text-headline text-ink">{order.tracking_id}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="text-caption text-ink-subtle">{order.dropy_order_id}</span>
              {order.us_order_id && <span className="text-caption text-ink-tertiary font-mono">US: {order.us_order_id}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium",
              isFinal ? "bg-semantic-success/12 text-semantic-success" : "bg-primary/12 text-primary-hover")}>
              {STAGES.find(s => s.key === order.current_stage)?.label ?? order.current_stage}
            </span>
            <PaymentBadge status={order.payment_status || "Unpaid"} />
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-hairline pt-5 md:grid-cols-4">
          {[["Customer", order.customer_name], ["Phone", order.customer_mobile],
            ["City", order.customer_city || "—"], ["Items", order.total_items],
            ["Weight", `${order.total_weight_kg} kg`], ["Mode", order.shipping_mode],
            ["ETA", order.estimated_delivery], ["Progress", `${order.progress}%`],
          ].map(([k, v]) => (
            <div key={k as string}><dt className="text-caption text-ink-tertiary">{k}</dt><dd className="mt-1 text-body-sm text-ink-muted">{v}</dd></div>
          ))}
        </dl>

        {items.length > 0 && (
          <div className="mt-5 border-t border-hairline pt-5">
            <p className="text-caption text-ink-tertiary mb-2">Items</p>
            <div className="flex flex-wrap gap-1.5">
              {items.map((it, i) => (
                <span key={i} className="rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-caption text-ink-subtle">{it.name} ×{it.qty}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stage + Payment + Delay handling */}
      {isFinal ? (
        <div className="rounded-xl border border-semantic-success/30 bg-semantic-success/8 p-6 text-center">
          <p className="text-body font-medium text-semantic-success">✓ Handed off for last-mile delivery</p>
          <p className="mt-1.5 text-body-sm text-ink-subtle">
            {order.last_mile_courier ? `Shipped via ${order.last_mile_courier}` : "Final stage complete"}
            {order.last_mile_awb ? ` — AWB ${order.last_mile_awb}` : ""}
          </p>
          {trackingUrl && (
            <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-body-sm font-medium text-primary hover:text-primary-hover">
              Track on {order.last_mile_courier}'s site <ArrowUpRight className="size-3.5" strokeWidth={2} />
            </a>
          )}
        </div>
      ) : (
        <Section title="Update order">
          {autoSuggested && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/8 px-4 py-3">
              <Zap className="size-4 text-primary mt-0.5 shrink-0" strokeWidth={1.8} />
              <p className="text-caption text-ink-subtle">
                Auto-suggested: <strong>{STAGES.find(s => s.key === suggested)?.label}</strong> based on {order.shipping_days ?? 10} working days
              </p>
            </motion.div>
          )}

          {awaitingHandover && (
            <div className="mb-4 rounded-lg border border-primary/25 bg-primary/8 px-4 py-3.5">
              <p className="text-body-sm font-medium text-ink">Hand off to last-mile courier</p>
              <p className="mt-1 text-caption text-ink-subtle">
                QC passed — enter the courier and AWB below to mark this order handed off. Setting both advances it automatically.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectInput label="Courier" value={lastMileCourier} onChange={setLastMileCourier}
                  options={[{ value: "", label: "Not yet handed off" }, ...LAST_MILE_COURIERS.map(c => ({ value: c, label: c }))]} />
                <div>
                  <label className="mb-1.5 block text-caption font-medium text-ink-subtle">AWB / tracking number</label>
                  <input value={lastMileAwb} onChange={e => setLastMileAwb(e.target.value)}
                    placeholder="e.g. SR123456789"
                    className="w-full rounded-lg border border-hairline bg-surface-1 px-3.5 py-2.5 text-body-sm text-ink placeholder:text-ink-tertiary focus:border-primary focus:outline-none transition-colors" />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectInput label="Shipping stage" value={stage} onChange={setStage}
              options={[
                ...STAGES.filter(s => s.key !== "handed_to_courier").map(s => ({ value: s.key, label: `${s.label} — ${STAGE_PROGRESS[s.key]}%${s.key === suggested ? " ← suggested" : ""}` })),
                { value: "exception", label: "⚠ Exception / Delayed" },
              ]} />
            <SelectInput label="Payment status" value={paymentStatus} onChange={setPaymentStatus}
              options={[...PAYMENT_STATUSES]} />
          </div>

          {stage === "exception" ? (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-lg border border-semantic-alert/30 bg-semantic-alert/8 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectInput label="Delay reason" value={delayReason} onChange={v => setDelayReason(v as DelayReason)}
                  options={[...reasonsForCurrentStage]} />
                <Input label={delayReason === "Other" ? "Details *" : "Details (optional)"} value={note} onChange={setNote}
                  placeholder="What happened, and what's next" />
              </div>
              {(() => {
                const profile = DELAY_PROFILES[delayReason];
                const { min, max } = resolveByEstimate(delayReason);
                const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                return (
                  <p className="mt-2.5 text-caption text-ink-subtle">
                    Typically resolves in <strong>{profile.minHours}–{profile.maxHours}h</strong> for this reason
                    — expected clear-by <strong>{fmt(min)}</strong> to <strong>{fmt(max)}</strong>.
                  </p>
                );
              })()}
              <p className="mt-2.5 text-[11px] text-ink-tertiary flex items-center gap-1">
                <AlertTriangle className="size-3 shrink-0" /> Shown to the customer on their tracking page. Auto-advance is paused until you move this order to a real stage again.
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-4">
              <div>
                <Input label="Shipping days" value={shippingDays} onChange={setShippingDays} type="number" />
                <p className="text-[11px] text-ink-tertiary mt-1 flex items-center gap-1">
                  <AlertTriangle className="size-3" /> Change if delayed or arriving early
                </p>
              </div>
              <Input label="Stage note" value={note} onChange={setNote} placeholder="e.g. Flight delayed, customs query" />
              <Input label="Admin notes" value={adminNotes} onChange={setAdminNotes} placeholder="Internal notes" />
            </div>
          )}
        </Section>
      )}

      {error && <p className="text-body-sm text-semantic-alert text-center">{error}</p>}
      {success && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-body-sm text-semantic-success text-center">{success}</motion.p>}

      <div className="flex gap-3">
        {!isFinal && (
          <Button onClick={handleUpdate} disabled={saving} className="flex-1">
            <Check className="size-3.5" /> {saving ? "Saving…" : "Save changes"}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={handleDelete}
          onBlur={() => setConfirmingDelete(false)}
          disabled={deleting}
          className="text-semantic-alert border-semantic-alert/30 hover:bg-semantic-alert/10"
        >
          <Trash2 className="size-3.5" />
          {deleting ? "Deleting…" : confirmingDelete ? `Confirm delete ${order.tracking_id}?` : "Delete"}
        </Button>
      </div>

      {/* Timeline */}
      <Section title="Timeline">
        {events.length === 0 ? (
          <p className="text-caption text-ink-tertiary py-4">No events yet.</p>
        ) : (
          <ol className="mt-2">
            {events.map((ev, i) => (
              <li key={ev.id} className="relative flex gap-4 pb-6 last:pb-0">
                {i < events.length - 1 && <span className="absolute top-5 bottom-0 left-[6px] w-px bg-hairline" />}
                <span className={cx("relative z-10 mt-1.5 flex size-3 shrink-0 rounded-full ring-4 ring-surface-1",
                  ev.state === "done" ? "bg-semantic-success" : ev.state === "current" ? "bg-primary" : "bg-surface-4")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={cx("text-body-sm", ev.state !== "pending" ? "text-ink" : "text-ink-tertiary", ev.state === "current" && "font-medium")}>{ev.label}</p>
                    <p className="font-mono text-[11px] text-ink-tertiary whitespace-nowrap">{ev.happened_at}</p>
                  </div>
                  <p className="text-caption text-ink-subtle mt-0.5">{ev.location}</p>
                  {ev.carrier && <p className="text-caption text-ink-tertiary mt-0.5">Moved by {ev.carrier}</p>}
                  {ev.note && <p className="text-caption text-ink-tertiary mt-1.5 rounded-md border border-hairline bg-surface-2 px-3 py-2">{ev.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

/* ── Shared UI ── */
function PaymentBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "Unpaid": "bg-semantic-alert/12 text-semantic-alert",
    "Partially Paid": "bg-semantic-warn/12 text-semantic-warn",
    "Fully Paid": "bg-semantic-success/12 text-semantic-success",
    "Cash on Delivery": "bg-primary/12 text-primary-hover",
    "Refunded": "bg-surface-3 text-ink-subtle",
  };
  const icons: Record<string, typeof Banknote> = {
    "Unpaid": Banknote, "Partially Paid": CreditCard, "Fully Paid": Check,
    "Cash on Delivery": Truck, "Refunded": ArrowLeft,
  };
  const Icon = icons[status] || Banknote;
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", styles[status] || styles["Unpaid"])}>
      <Icon className="size-3" strokeWidth={2} /> {status}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-6">
      <h3 className="text-body font-medium text-ink mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, onKeyDown }: {
  label?: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  return (
    <div>
      {label && <label className="text-caption text-ink-subtle mb-1.5 block">{label}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKeyDown}
        className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-tertiary focus:border-primary focus:outline-none transition-colors" />
    </div>
  );
}

function SelectInput({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <div>
      <label className="text-caption text-ink-subtle mb-1.5 block">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2.5 text-body-sm text-ink focus:border-primary focus:outline-none transition-colors">
        {options.map(opt => {
          const v = typeof opt === "string" ? opt : opt.value;
          const l = typeof opt === "string" ? opt : opt.label;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </div>
  );
}