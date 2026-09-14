<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { STAGES } from "$lib/types";
  import StageTimeline from "$lib/components/StageTimeline.svelte";
  import Crossing from "$lib/components/Crossing.svelte";
  import Card from "$lib/components/Card.svelte";
  import { copyText } from "$lib/copy-text";
  import { calendarDays, etaFor, formatEta } from "$lib/dates";
  import { effectiveOrderStage } from "$lib/order-routes";

  /** Admin order detail — A3. Single scroll, actions in a card at the foot. */

  const id = page.params.id;

  let order = $state<any>(null);
  let events = $state<any[]>([]);
  let route = $state<any>(null);
  let routeError = $state("");
  let audit = $state<any[]>([]);
  let role = $state<"admin" | "staff">("staff");
  let error = $state(""), success = $state(""), busy = $state(false);
  let copied = $state(false), confirmDelete = $state(false);
  /* Extending the window and flagging a hold. Both existed as bridge
     endpoints nothing called, so neither was reachable by a person. */
  let addDays = $state(1);
  let dayReason = $state("");
  let delayReason = $state("");
  /* What Apply would do, from the SAME conversion the server uses. Two
     implementations of a calendar window is how admin and the customer
     page came to disagree by 14h24m. */
  const nextDays = $derived(
    order && Number.isInteger(Number(addDays)) && Number(addDays) !== 0
      ? (order.shipping_days ?? 12) + Number(addDays) : null);
  const nextEta = $derived.by(() => {
    if (!order || nextDays === null) return "";
    const d = new Date(order.order_date);
    d.setDate(d.getDate() + calendarDays(nextDays));
    return formatEta(d);
  });

  /* Admin sees what the customer sees. Derived from the same function
     the customer page uses, so the two cannot report different dates. */
  const doorstepEta = $derived.by(() => {
    if (!order) return "";
    const { doorstep } = etaFor(order);
    return doorstep ? formatEta(doorstep) : "";
  });

  let moveTo = $state(""), moveAt = $state(""), note = $state("");

  /* Distinguishes "still loading" from "loaded, and there is nothing".
     Without it a thrown fetch left the page on its spinner forever. */
  let loaded = $state(false);

  onMount(async () => {
    try {
      const me = await fetch("/api/admin/me");
      if (me.ok) role = (await me.json()).role;

      // One request for one order. This used to pull 100 rows and search
      // them here, which failed outright for any order outside that page.
      const res = await fetch(`/api/admin/orders/${id}`);
      if (res.ok) {
        const j = await res.json();
        order = j.order ?? null;
        events = j.events ?? [];
        route = j.route ?? null;
        routeError = j.routeError ?? "";
        if (!order) error = "Order not found.";
      } else {
        error = res.status === 404 ? "Order not found." : `Could not load this order (${res.status}).`;
      }

      // Admin-only. Staff get 403, which isn't an error worth alarming
      // them about — the panel simply isn't for them.
      const au = await fetch(`/api/admin/audit?order_id=${id}&limit=50`);
      if (au.ok) audit = (await au.json()).entries ?? [];
    } catch (e) {
      // A rejected onMount is invisible: no error, no render, spinner forever.
      error = `Could not load this order — ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      loaded = true;
    }
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

  async function extend() {
    const n = Number(addDays);
    if (!Number.isInteger(n) || n === 0) { error = "How many days? Negative shortens."; return; }
    if (!dayReason.trim()) { error = "Say why the window is changing."; return; }
    if (await call(`/api/admin/orders/${id}/add-days`, { add_days: n, reason: dayReason.trim() })) {
      success = "Window updated — the ETA and every remaining stage moved with it.";
      setTimeout(() => location.reload(), 900);
    }
  }

  async function flagDelay(clear: boolean) {
    if (!clear && !delayReason.trim()) { error = "Say what the hold-up is."; return; }
    if (await call(`/api/admin/orders/${id}/delay`,
        clear ? { clear: true } : { reason: delayReason.trim() })) {
      success = clear ? "Hold cleared." : "Flagged as delayed.";
      setTimeout(() => location.reload(), 900);
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

  /* The Move-to list has to start after where the parcel ACTUALLY is,
     not after the last stage someone recorded. Built from the stored
     column it offered stages the timeline already shows as passed. */
  const liveStage = $derived(
    !order ? ""
      : order.current_stage === "exception" || order.current_stage === "damaged"
        ? order.current_stage
        : effectiveOrderStage(order.route_key, order.current_stage,
            order.order_date, order.shipping_days ?? 12, order.timing_seed ?? 0));
  const currentIdx = $derived(liveStage ? STAGES.findIndex((s) => s.key === liveStage) : -1);
  const forward = $derived(currentIdx >= 0 ? STAGES.slice(currentIdx + 1) : STAGES);
  const items = $derived(
    order ? (typeof order.items === "string" ? JSON.parse(order.items) : order.items ?? []) : [],
  );
  const dt = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
</script>

<svelte:head><title>Order · DotConnects Admin</title><meta name="robots" content="noindex" /></svelte:head>

{#if !order}
  <!-- `loaded` is what separates the two. Reading only `error` meant a
       failure that set no message showed "Loading…" indefinitely. -->
  <p class="center">
    {#if !loaded}Loading…
    {:else}{error || "Order not found."} <a href="/admin">← Back to orders</a>{/if}
  </p>
{:else}
  <div class="top">
    <a class="brand" href="/" title="DotConnects Logistics">
      <img src="/logo.png" alt="DotConnects Logistics" width="45" height="26" />
    </a>
    <a href="/admin">← Orders</a>
    <span class="mono">{order.tracking_id}</span>
    <span class="dim">{order.dropy_order_id}</span>
    {#if order.replacement_of}<span class="badge">Redispatch</span>{/if}
    <button class="ghost" onclick={copyLink}>{copied ? "Link copied" : "Copy tracking link"}</button>
  </div>

  <main>
    {#if error}<p class="err">⚠ {error}</p>{/if}
    {#if success}<p class="ok">{success}</p>{/if}

    <!-- One grid cell on wide screens: facts with the route under them,
         the stage timeline beside both. -->
    <div class="stack">
    <Card title="Facts">
      <dl class="facts">
        <div><dt>Customer</dt><dd class="strong">{order.customer_name}</dd></div>
        <div><dt>Phone</dt><dd class="mono">{order.customer_mobile}</dd></div>
        <div><dt>City</dt><dd>{order.customer_city ?? "—"}</dd></div>
        <div><dt>Mode</dt><dd>{order.shipping_mode}</dd></div>
        <div><dt>Payment</dt><dd>{order.payment_status ?? "Unpaid"}</dd></div>
        <div><dt>Shipping days</dt><dd>{order.shipping_days ?? "—"}</dd></div>
        <div><dt>Ordered</dt><dd>{dt(order.order_date)}</dd></div>
        <div><dt>ETA (Vashi)</dt><dd>{order.estimated_delivery || "—"}</dd></div>
        <div>
          <dt>ETA (doorstep)</dt>
          <dd>
            {#if doorstepEta}
              {doorstepEta} <span class="dim">+{order.doorstep_days}d</span>
            {:else}—{/if}
          </dd>
        </div>
      </dl>
    </Card>

    <Card title="Route">
      {#if route}
        <Crossing origin={route.origin} destination={route.destination} progress={route.progress} mode={route.mode} />
      {:else}
        <p class="hint">Couldn't draw the route{routeError ? ` — ${routeError}` : "."}</p>
      {/if}
    </Card>
    </div>

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
    <!-- Actions.
         These lived in a bar pinned to the bottom of the window: no
         labels, a button reading "13d +", and two more bars stacking
         above it. The bar existed to stay reachable on a long page,
         which is a phone problem, and admin is desktop only. A card with
         a row per action says what each one does and what it will change
         BEFORE it is pressed -- which is the whole point of the window
         row, since changing it moves dates a customer has already seen. -->
    <div class="actions">
    <Card title="Actions">
      <div class="act">
        <div class="what"><b>Move stage</b>
          <span>Record that the parcel reached a point on its route.</span></div>
        <div class="ctl">
          <select bind:value={moveTo}>
            <option value="">Select stage…</option>
            {#each forward as s}<option value={s.key}>{s.label}</option>{/each}
          </select>
          <input type="datetime-local" bind:value={moveAt} />
          <input class="grow" placeholder="Note (optional)" bind:value={note} />
        </div>
        <button class="primary" onclick={moveStage} disabled={busy || !moveTo}>Move</button>
      </div>

      <div class="act">
        <div class="what"><b>Shipping window</b>
          <span>Extend or shorten the whole journey. Every remaining stage moves
            with it, not just the final date.</span></div>
        <div class="ctl">
          <span class="now">now {order.shipping_days ?? 12} days · ETA {order.estimated_delivery || "—"}</span>
          <input class="num" type="number" step="1" bind:value={addDays} aria-label="Days to add or remove" />
          <span class="now">days</span>
          <input class="grow" placeholder="Why? e.g. carrier reported a 3-day customs backlog"
                 bind:value={dayReason} />
          {#if nextDays !== null}
            <!-- Shown before Apply, not after. A date the customer has seen
                 is about to change, so the change is stated first. -->
            <div class="preview">
              {order.shipping_days ?? 12} days <span class="arrow">→</span> <b>{nextDays} days</b>
              · ETA {order.estimated_delivery || "—"} <span class="arrow">→</span> <b>{nextEta}</b>
            </div>
          {/if}
        </div>
        <button class="primary" onclick={extend} disabled={busy || !addDays}>Apply</button>
      </div>

      <div class="act">
        <div class="what"><b>Flag delayed</b>
          <span>The parcel has stopped somewhere it shouldn't have. The customer
            sees it as held rather than as progress.</span></div>
        {#if order.current_stage === "exception"}
          <div class="ctl">
            <span class="held">⚠ Currently held</span>
            <div class="preview">
              Clearing returns it to where the clock says it should be by now —
              not back to the stage it stopped at.
            </div>
          </div>
          <button class="primary" onclick={() => flagDelay(true)} disabled={busy}>Clear hold</button>
        {:else}
          <div class="ctl">
            <input class="grow" placeholder="What's the hold-up? e.g. stuck at Delhi customs"
                   bind:value={delayReason} />
          </div>
          <button onclick={() => flagDelay(false)} disabled={busy}>Flag delayed</button>
        {/if}
      </div>

      {#if role === "admin"}
        <div class="act danger-zone">
          <div class="what"><b>Delete order</b>
            <span>Removes it from every list and stops the tracking link working.</span></div>
          <div class="ctl"><span class="now">Recoverable from the deleted list.</span></div>
          <button class="danger" onclick={del} disabled={busy}>
            {confirmDelete ? "Confirm?" : "Delete"}</button>
        </div>
      {/if}
    </Card>
    </div>
  </main>
{/if}

<style>
  /* Actions. A row per action: what it is, its controls, its button.
     Desktop only -- no breakpoints, by design. */
  .act { display: grid; grid-template-columns: 190px 1fr auto; gap: 18px; align-items: start;
         padding: 16px 0; border-bottom: 1px solid var(--color-hairline-tertiary); }
  .act:last-child { border-bottom: 0; padding-bottom: 0; }
  .act .what b { display: block; font-size: 13.5px; font-weight: 600; }
  .act .what span { display: block; font-size: 12px; color: var(--color-ink-tertiary);
                    margin-top: 3px; line-height: 1.45; }
  .act .ctl { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .act .ctl .grow { flex: 1; min-width: 200px; }
  .act .num { width: 78px; text-align: right; }
  .act .now { font-size: 12px; color: var(--color-ink-tertiary); white-space: nowrap; }
  .act .preview { flex-basis: 100%; font-size: 12.5px; color: var(--color-ink-subtle); }
  .act .preview b { color: var(--color-ink); }
  .act .arrow { color: var(--color-primary); font-weight: 600; }
  .act .held { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 20px;
               background: #fbf1de; color: #8a5a05; font-size: 12px; font-weight: 600; }
  /* Delete kept apart from the routine actions, not beside them. */
  .act.danger-zone { margin: 0 -22px -18px; padding: 16px 22px; background: var(--color-surface-2);
                     border-bottom: 0; border-top: 1px solid var(--color-hairline); }
  .center { text-align: center; padding: 48px; color: var(--color-ink-subtle); }

  .brand { display: flex; align-items: center; flex: none; }
  .brand img { display: block; height: 22px; width: auto; }
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

  main { max-width: 860px; margin: 0 auto; padding: 16px 16px 32px; display: flex; flex-direction: column; gap: 12px; }

  /* Two columns from 1000px: facts and timeline on the left, the things
     you act on and the record of what happened on the right. */
  @media (min-width: 1000px) {
    main {
      max-width: 1240px; padding: 20px 32px 32px;
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      gap: 14px 20px;
      align-items: start;
    }
    .top { padding: 12px 32px; }
    /* Actions runs the full width. Squeezed into one column, the label,
       the controls and the button fight over about 380px. */
    .actions { grid-column: 1 / -1; }
  }

  .stack { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
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
