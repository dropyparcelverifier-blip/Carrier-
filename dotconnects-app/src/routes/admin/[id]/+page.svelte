<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { STAGES } from "$lib/types";
  import StageTimeline from "$lib/components/StageTimeline.svelte";
  import Card from "$lib/components/Card.svelte";
  import { copyText } from "$lib/copy-text";

  /** Admin order detail — A3. Single scroll, sticky action bar. */

  const id = page.params.id;

  let order = $state<any>(null);
  let events = $state<any[]>([]);
  let audit = $state<any[]>([]);
  let role = $state<"admin" | "staff">("staff");
  let error = $state(""), success = $state(""), busy = $state(false);
  let copied = $state(false), confirmDelete = $state(false);

  let moveTo = $state(""), moveAt = $state(""), note = $state("");

  onMount(async () => {
    const me = await fetch("/api/admin/me");
    if (me.ok) role = (await me.json()).role;

    // The list endpoint already derives live_stage; reuse it rather than
    // duplicating that logic here.
    const list = await fetch(`/api/admin/orders?pageSize=100`);
    if (list.ok) {
      const j = await list.json();
      order = j.orders.find((o: any) => o.id === id) ?? null;
      if (!order) error = "Order not found in the current page of results.";
    }

    const ev = await fetch(`/api/admin/orders/${id}`);
    if (ev.ok) events = (await ev.json()).events ?? [];

    // Admin-only. Staff get 403, which isn't an error worth alarming
    // them about — the panel simply isn't for them.
    const au = await fetch(`/api/admin/audit?order_id=${id}&limit=50`);
    if (au.ok) audit = (await au.json()).entries ?? [];
  });

  async function call(url: string, body?: unknown, method = "POST") {
    error = ""; success = ""; busy = true;
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { error = j.error ?? `Request failed (${res.status})`; return false; }
      return true;
    } catch { error = "Couldn't reach the server."; return false; }
    finally { busy = false; }
  }

  async function moveStage() {
    if (!moveTo) { error = "Pick a stage to move to."; return; }
    if (await call(`/api/admin/orders/${id}/stage`, {
      stage: moveTo,
      happenedAt: moveAt ? new Date(moveAt).toISOString() : undefined,
      note: note.trim() || undefined,
    })) { success = "Stage moved."; setTimeout(() => location.reload(), 700); }
  }

  async function milestone(m: "label" | "picked" | "delivered") {
    if (await call(`/api/admin/orders/${id}/milestone`, { milestone: m })) {
      success = "Recorded."; setTimeout(() => location.reload(), 700);
    }
  }

  async function del() {
    if (!confirmDelete) { confirmDelete = true; return; }
    if (await call(`/api/admin/orders/${id}`, undefined, "DELETE")) location.href = "/admin";
  }

  async function copyLink() {
    const url = `${location.origin}/?id=${encodeURIComponent(order.tracking_id)}&phone=${encodeURIComponent(order.customer_mobile)}`;
    if (await copyText(url)) { copied = true; setTimeout(() => (copied = false), 2000); }
  }

  const currentIdx = $derived(order ? STAGES.findIndex((s) => s.key === order.current_stage) : -1);
  const forward = $derived(currentIdx >= 0 ? STAGES.slice(currentIdx + 1) : STAGES);
  const items = $derived(
    order ? (typeof order.items === "string" ? JSON.parse(order.items) : order.items ?? []) : [],
  );
  const dt = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
</script>

<svelte:head><title>Order · DotConnects Admin</title><meta name="robots" content="noindex" /></svelte:head>

{#if !order}
  <p class="center">{error || "Loading…"}</p>
{:else}
  <div class="top">
    <a href="/admin">← Orders</a>
    <span class="mono">{order.tracking_id}</span>
    <span class="dim">{order.dropy_order_id}</span>
    {#if order.replacement_of}<span class="badge">Redispatch</span>{/if}
    <button class="ghost" onclick={copyLink}>{copied ? "Link copied" : "Copy tracking link"}</button>
  </div>

  <main>
    {#if error}<p class="err">⚠ {error}</p>{/if}
    {#if success}<p class="ok">{success}</p>{/if}

    <Card title="Facts">
      <dl class="facts">
        <div><dt>Customer</dt><dd class="strong">{order.customer_name}</dd></div>
        <div><dt>Phone</dt><dd class="mono">{order.customer_mobile}</dd></div>
        <div><dt>City</dt><dd>{order.customer_city ?? "—"}</dd></div>
        <div><dt>Mode</dt><dd>{order.shipping_mode}</dd></div>
        <div><dt>Payment</dt><dd>{order.payment_status ?? "Unpaid"}</dd></div>
        <div><dt>Shipping days</dt><dd>{order.shipping_days ?? "—"}</dd></div>
        <div><dt>Ordered</dt><dd>{dt(order.order_date)}</dd></div>
        <div><dt>ETA</dt><dd>{order.estimated_delivery || "—"}</dd></div>
      </dl>
    </Card>

    <Card title="Stage timeline">
      <StageTimeline
        routeKey={order.route_key}
        orderDate={order.order_date}
        shippingDays={order.shipping_days ?? 10}
        timingSeed={order.timing_seed ?? 0}
        currentStage={order.current_stage}
        clockAnchorStage={order.clock_anchor_stage}
        clockAnchorAt={order.clock_anchor_at}
        labelGeneratedAt={order.label_generated_at}
        pickedUpAt={order.picked_up_at}
        {events}
      />
    </Card>

    <Card title="Milestones">
      <p class="hint">
        Normally set by the courier webhook. Record by hand when one doesn't
        arrive — Velocity has no automatic path yet.
      </p>
      <div class="miles">
        {#each [
          { k: "label", label: "Label generated", at: order.label_generated_at, blocked: false },
          { k: "picked", label: "Picked up", at: order.picked_up_at, blocked: !order.label_generated_at },
          { k: "delivered", label: "Delivered", at: order.delivered_at, blocked: !order.picked_up_at },
        ] as m}
          {#if m.at}
            <span class="done">✓ {m.label} — {dt(m.at)}</span>
          {:else}
            <button class="ghost" disabled={busy || m.blocked}
                    onclick={() => milestone(m.k as any)}>
              Record {m.label.toLowerCase()}
            </button>
          {/if}
        {/each}
      </div>
    </Card>

    <Card title="Items ({items.length})">
      {#each items as it}
        <div class="item"><span>{it.name}</span><span class="dim">×{it.qty} · {it.weight_g}g</span></div>
      {:else}
        <p class="hint">No items recorded.</p>
      {/each}
    </Card>

    <Card title="Audit trail">
      {#each audit as a}
        <div class="aud">
          <span class="mono dim">{new Date(a.created_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})} {new Date(a.created_at).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</span>
          <span class="who" class:sys={a.actor_type === "system"}>
            {a.actor_type === "system" ? "⚙" : "🧑"} {a.actor_name}
          </span>
          <span class="what">{a.note || a.action}</span>
        </div>
      {:else}
        <p class="hint">No recorded changes yet.</p>
      {/each}
    </Card>
  </main>

  <!-- Sticky action bar — stays reachable however far you scroll -->
  <div class="sticky">
    <span class="lbl">Move to</span>
    <select bind:value={moveTo}>
      <option value="">Select stage…</option>
      {#each forward as s}<option value={s.key}>{s.label}</option>{/each}
    </select>
    <input type="datetime-local" bind:value={moveAt} />
    <button class="primary" onclick={moveStage} disabled={busy || !moveTo}>Move</button>
    {#if role === "admin"}
      <button class="danger" onclick={del} disabled={busy}>
        {confirmDelete ? "Confirm?" : "Delete"}
      </button>
    {/if}
  </div>
{/if}

<style>
  .center { text-align: center; padding: 48px; color: var(--color-ink-subtle); }

  .top {
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
    padding: 10px 16px; border-bottom: 1px solid var(--color-hairline);
    background: var(--color-surface-1); font-size: 14px;
  }
  .top a { font-weight: 600; }
  .top .ghost { margin-left: auto; }
  .dim { color: var(--color-ink-subtle); }
  .badge {
    padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
    text-transform: uppercase; color: var(--color-semantic-warn);
    border: 1px solid var(--color-semantic-warn);
  }

  main { max-width: 860px; margin: 0 auto; padding: 16px 16px 88px; display: flex; flex-direction: column; gap: 12px; }

  .facts { display: grid; grid-template-columns: 1fr; margin: 0; }
  .facts > div { padding: 8px 0; border-bottom: 1px solid var(--color-hairline); }
  .facts > div:last-child { border-bottom: 0; }
  dt { font-size: 12px; color: var(--color-ink-subtle); }
  dd { margin: 2px 0 0; font-size: 14px; }
  .strong { font-weight: 600; }

  .hint { margin: 0 0 10px; font-size: 12px; color: var(--color-ink-tertiary); }
  .miles { display: flex; flex-wrap: wrap; gap: 8px; }
  .done {
    padding: 8px 12px; border-radius: 10px; font-size: 12px;
    color: var(--color-semantic-success); border: 1px solid var(--color-semantic-success);
  }

  .item { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--color-hairline); font-size: 13px; }
  .item:last-child { border-bottom: 0; }

  .aud { display: flex; flex-wrap: wrap; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--color-hairline); font-size: 12px; }
  .aud:last-child { border-bottom: 0; }
  .who { font-weight: 600; white-space: nowrap; }
  .who.sys { color: var(--color-semantic-info); }
  .what { color: var(--color-ink-muted); }

  .sticky {
    position: fixed; inset: auto 0 0 0; z-index: 40;
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid var(--color-hairline-strong);
    background: color-mix(in srgb, var(--color-surface-1) 95%, transparent);
    backdrop-filter: blur(8px);
  }
  .sticky .lbl { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--color-ink-subtle); }
  .sticky select { flex: 1; min-width: 0; }
  select, input[type="datetime-local"] {
    padding: 8px 10px; border: 1px solid var(--color-hairline);
    border-radius: 8px; background: var(--color-surface-1); font-size: 13px;
  }

  button { min-height: 0; }
  .ghost {
    padding: 8px 12px; border: 1px solid var(--color-hairline);
    border-radius: 10px; background: var(--color-surface-1);
    cursor: pointer; font-size: 12px;
  }
  .ghost:disabled { opacity: 0.4; cursor: default; }
  .primary {
    padding: 8px 14px; border: 0; border-radius: 8px; cursor: pointer;
    background: var(--color-primary); color: #fff; font-weight: 600; font-size: 13px;
  }
  .primary:disabled { opacity: 0.4; }
  .danger {
    padding: 8px 12px; border: 1px solid var(--color-hairline); border-radius: 8px;
    background: none; cursor: pointer; font-size: 13px; color: var(--color-semantic-alert);
  }

  .err, .ok { margin: 0; padding: 10px 12px; border-radius: 8px; font-size: 13px; border: 1px solid; }
  .err { color: var(--color-semantic-alert); border-color: var(--color-semantic-alert); }
  .ok { color: var(--color-semantic-success); border-color: var(--color-semantic-success); }

  @media (min-width: 640px) { .facts { grid-template-columns: 1fr 1fr; column-gap: 24px; } }
</style>
