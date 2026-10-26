<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { STAGES } from "$lib/types";
  import StageTimeline from "$lib/components/StageTimeline.svelte";
  import Crossing from "$lib/components/Crossing.svelte";
  import Card from "$lib/components/Card.svelte";
  import { copyText } from "$lib/copy-text";
  import { calendarDays, etaFor, formatEta } from "$lib/dates";
  import { journeyView } from "$lib/journey";
  import { shareMessage } from "$lib/share-text";
  import { BRANDS } from "$lib/brands";

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
  let copiedText = $state(false);
  /* null = Dropy team. A brand login (Rudra) never sees Dropy's own tools. */
  let brand = $state<string | null>(null);
  /* Signed customer link from the server — always the track. host. */
  let trackLink = $state("");
  /* Brand orders only: their India leg, edit, damaged and cancel are done
     here. A Dropy order's are DOC's, so these never show on one. */
  const isBrandOrder = $derived(!!order?.brand && order.brand !== "dropy");
  const brandLabel = $derived(isBrandOrder ? (BRANDS[order.brand as keyof typeof BRANDS]?.name ?? order.brand) : "");

  let shipCourier = $state("Velocity"), shipAwb = $state(""), shipUrl = $state(""), shipEdd = $state("");
  let shipWarning = $state("");
  let editing = $state(false), editUsId = $state(""), editReason = $state("");
  let editItems = $state<{ name: string; qty: number; weight_g: number }[]>([]);
  let dmgUsId = $state(""), dmgNote = $state(""), dmgConfirm = $state(false);
  let cancelReason = $state(""), cancelConfirm = $state(false);
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
      if (me.ok) { const m = await me.json(); role = m.role; brand = m.brand ?? null; }

      // One request for one order. This used to pull 100 rows and search
      // them here, which failed outright for any order outside that page.
      const res = await fetch(`/api/admin/orders/${id}`);
      if (res.ok) {
        const j = await res.json();
        order = j.order ?? null;
        events = j.events ?? [];
        route = j.route ?? null;
        routeError = j.routeError ?? "";
        trackLink = j.trackLink ?? "";
        if (!order) error = "Order not found.";
        if (order) {
          shipCourier = order.last_mile_courier || "Velocity";
          shipAwb = order.last_mile_awb || "";
          shipUrl = order.last_mile_tracking_url || "";
        }
      } else {
        error = res.status === 404 ? "Order not found." : `Could not load this order (${res.status}).`;
      }

      // Admin-only. Staff get 403, which isn't an error worth alarming
      // them about — the panel simply isn't for them.
      if (!brand) {
        const au = await fetch(`/api/admin/audit?order_id=${id}&limit=50`);
        if (au.ok) audit = (await au.json()).entries ?? [];
      }
    } catch (e) {
      // A rejected onMount is invisible: no error, no render, spinner forever.
      error = `Could not load this order — ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      loaded = true;
    }
  });

  let lastReply: any = null;
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
      lastReply = j;
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

  /* The customer link. Was `${location.origin}/?id=…&phone=…` — on a
     brand's admin host that would hand the customer the admin host and
     put their phone number in the URL. Now the signed track. link the
     server builds, same as Order Central sends. */
  async function copyLink() {
    if (!trackLink) { error = "No tracking link — TRACK_LINK_SECRET isn't set on DOT."; return; }
    if (await copyText(trackLink)) { copied = true; setTimeout(() => (copied = false), 2000); }
  }

  async function copyMessage() {
    if (!trackLink) { error = "No tracking link — TRACK_LINK_SECRET isn't set on DOT."; return; }
    if (await copyText(shareMessage(order, trackLink))) {
      copiedText = true; setTimeout(() => (copiedText = false), 2000);
    }
  }

  async function shipIndia() {
    shipWarning = "";
    if (!shipAwb.trim() || !shipUrl.trim()) { error = "Enter the AWB and paste the tracking link."; return; }
    if (await call(`/api/admin/orders/${id}/handover`, {
      courier: shipCourier, awb: shipAwb.trim(), tracking_url: shipUrl.trim(),
      edd: shipEdd || undefined,
    })) {
      shipWarning = lastReply?.warning ?? "";
      success = "Saved — the customer's link now opens the courier page.";
      if (!shipWarning) setTimeout(() => location.reload(), 1200);
    }
  }

  function startEdit() {
    editItems = items.map((it: any) => ({ name: it.name ?? "", qty: Number(it.qty) || 1, weight_g: Number(it.weight_g) || 0 }));
    if (!editItems.length) editItems = [{ name: "", qty: 1, weight_g: 0 }];
    editUsId = order.us_order_id ?? "";
    editReason = ""; editing = true;
  }

  async function saveEdit() {
    const list = editItems.filter((i) => i.name.trim());
    if (!list.length) { error = "Keep at least one item — to empty it, cancel the tracking."; return; }
    if (!editReason.trim()) { error = "Say why it's being corrected."; return; }
    const weighed = list.every((i) => Number(i.weight_g) > 0);
    if (await call(`/api/admin/orders/${id}/edit`, {
      items: list.map((i) => ({ name: i.name.trim(), qty: Number(i.qty) || 1, weight_g: Number(i.weight_g) || 0 })),
      total_items: list.reduce((n, i) => n + (Number(i.qty) || 1), 0),
      total_weight_kg: weighed ? list.reduce((g, i) => g + Number(i.weight_g) * (Number(i.qty) || 1), 0) / 1000 : null,
      us_order_id: editUsId.trim() || undefined,
      reason: editReason.trim(),
    })) { success = "Saved."; editing = false; setTimeout(() => location.reload(), 900); }
  }

  async function markDamaged() {
    if (!dmgConfirm) { dmgConfirm = true; return; }
    dmgConfirm = false;
    const body: Record<string, unknown> = { note: dmgNote.trim() || undefined };
    if (dmgUsId.trim()) body.replacement = { us_order_id: dmgUsId.trim() };
    if (await call(`/api/admin/orders/${id}/damaged`, body)) {
      const r = lastReply?.replacement;
      success = r
        ? `Marked damaged. Replacement ${r.dropy_order_id} · ${r.tracking_id} created — open it to copy its link.`
        : lastReply?.replacementError
          ? `Marked damaged, but the replacement wasn't made: ${lastReply.replacementError}`
          : "Marked damaged.";
      if (r) setTimeout(() => (location.href = `/admin/${r.id}`), 2200);
      else setTimeout(() => location.reload(), 1500);
    }
  }

  async function cancelTracking() {
    if (!cancelReason.trim()) { error = "Say why it's being cancelled."; return; }
    if (!cancelConfirm) { cancelConfirm = true; return; }
    cancelConfirm = false;
    if (await call(`/api/admin/orders/${id}/cancel`, { reason: cancelReason.trim() })) {
      success = "Cancelled — the customer's page now says it isn't coming.";
      setTimeout(() => location.reload(), 1200);
    }
  }

  /* The Move-to list has to start after where the parcel ACTUALLY is,
     not after the last stage someone recorded. Built from the stored
     column it offered stages the timeline already shows as passed. */
  /* One rule, shared with the customer page. This carried its own copy
     of the hold check until 15 Sept and it had already diverged: it
     guarded exception and damaged, never learned about cancelled, and
     knew nothing of held_at -- so a damaged parcel's admin timeline
     showed all fourteen stages complete while the customer's showed the
     truth. The findings doc warned this rule was copied five times and
     would diverge a sixth. It had. */
  const view = $derived(order ? journeyView(order) : null);
  const liveStage = $derived(view?.journey ?? "");
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
    {#if isBrandOrder}<span class="brandtag">{brandLabel}</span>{/if}
    {#if order.replacement_of}<span class="badge">Redispatch</span>{/if}
    <button class="ghost push" onclick={copyLink}>{copied ? "Link copied" : "Copy tracking link"}</button>
    <button class="ghost" onclick={copyMessage}>{copiedText ? "Text copied" : "Copy WhatsApp text"}</button>
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
            <!-- D4. A bare em dash is indistinguishable from a bug. Three
                 different situations produced it and staff had no way to
                 tell which, so every blank one looked like something to
                 report. -->
            {#if doorstepEta}
              {doorstepEta} <span class="dim">+{order.doorstep_days}d</span>
            {:else if view?.frozen || view?.capped}
              <span class="dim">not shown — parcel is {order.current_stage}</span>
            {:else if !order.doorstep_days}
              <span class="dim">no courier figure for {order.customer_pincode || 'this pincode'}</span>
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
        heldAt={order.held_at}
        delayedAt={order.delayed_at}
        delayTotalMs={order.delay_total_ms ?? 0}
        {events}
      />
    </Card>

    {#if isBrandOrder}
    <Card title="Shipped in India">
      <p class="hint">
        Book it in your Velocity or Shiprocket panel, then paste it here. The
        customer's same link then opens the courier's page. Wrong AWB? Save
        again with the right one.
      </p>
      <div class="ship">
        <label><span>Courier</span>
          <select bind:value={shipCourier}><option>Velocity</option><option>Shiprocket</option></select></label>
        <label><span>AWB</span><input class="mono" bind:value={shipAwb} placeholder="e.g. 81052817123" /></label>
        <label><span>Expected delivery (optional)</span><input type="date" bind:value={shipEdd} /></label>
        <label class="wide"><span>Indian tracking link</span>
          <input class="mono" bind:value={shipUrl} placeholder="https://www.velocityshipping.in/track/…" /></label>
      </div>
      {#if shipWarning}<p class="warn">⚠ {shipWarning}</p>{/if}
      <button class="primary" onclick={shipIndia} disabled={busy || order.deleted_at || ["cancelled", "damaged"].includes(order.current_stage)}>
        {order.current_stage === "handed_to_courier" ? "Update courier" : "Save — handed to courier"}</button>
    </Card>
    {/if}

    {#if !brand}
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
    {/if}

    <Card title="Items ({items.length})">
      {#each items as it}
        <div class="item"><span>{it.name}</span><span class="dim">×{it.qty} · {it.weight_g}g</span></div>
      {:else}
        <p class="hint">No items recorded.</p>
      {/each}
    </Card>

    {#if !brand}
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
    {/if}
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
      {#if !brand}
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
      {/if}

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
          <button class="ghost" onclick={() => flagDelay(false)} disabled={busy}>Flag delayed</button>
        {/if}
      </div>

      {#if isBrandOrder}
        <div class="act">
          <div class="what"><b>Edit</b>
            <span>Wrong items or US order ID. Dates and the tracking ID don't change.</span></div>
          {#if editing}
            <div class="ctl">
              {#each editItems as it, i}
                <div class="eitem">
                  <input class="grow" bind:value={it.name} placeholder="Product name" />
                  <input class="num" type="number" min="1" bind:value={it.qty} aria-label="Qty" />
                  <input class="num" type="number" min="0" bind:value={it.weight_g} aria-label="Grams" placeholder="g" />
                  {#if editItems.length > 1}<button class="ghost" onclick={() => (editItems = editItems.filter((_, n) => n !== i))} aria-label="Remove">×</button>{/if}
                </div>
              {/each}
              <button class="ghost" onclick={() => (editItems = [...editItems, { name: "", qty: 1, weight_g: 0 }])}>+ Item</button>
              <input class="grow mono" bind:value={editUsId} placeholder="US order ID" />
              <input class="grow" bind:value={editReason} placeholder="Why? (required)" />
            </div>
            <div class="btns">
              <button class="primary" onclick={saveEdit} disabled={busy}>Save</button>
              <button class="ghost" onclick={() => (editing = false)}>Close</button>
            </div>
          {:else}
            <div class="ctl"><span class="now">{items.length} item(s) · US order {order.us_order_id || "—"}</span></div>
            <button class="ghost" onclick={startEdit} disabled={busy || ["cancelled", "damaged"].includes(order.current_stage)}>Edit…</button>
          {/if}
        </div>

        <div class="act">
          <div class="what"><b>Damaged</b>
            <span>Holds this tracking as damaged. Give a new US order ID to start a replacement tracking now.</span></div>
          <div class="ctl">
            <input class="grow mono" bind:value={dmgUsId} placeholder="New US order ID (optional)" />
            <input class="grow" bind:value={dmgNote} placeholder="Note (optional)" />
          </div>
          <button class="ghost" onclick={markDamaged} disabled={busy || order.current_stage === "damaged"}>
            {dmgConfirm ? "Confirm?" : "Mark damaged"}</button>
        </div>

        <div class="act">
          <div class="what"><b>Cancel tracking</b>
            <span>The customer's page will say the parcel isn't coming.</span></div>
          <div class="ctl">
            <input class="grow" bind:value={cancelReason} placeholder="Why? (required)" />
          </div>
          <button class="danger" onclick={cancelTracking} disabled={busy || order.current_stage === "cancelled" || !!order.delivered_at}>
            {cancelConfirm ? "Confirm cancel?" : "Cancel"}</button>
        </div>
      {/if}

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
  .top .ghost.push { margin-left: auto; }
  .brandtag { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
              color: #8a5a05; background: #fbf1de; border: 1px solid #f0d49c; }
  .ship { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .ship label { display: flex; flex-direction: column; gap: 4px; }
  .ship label span { font-size: 12px; color: var(--color-ink-subtle); }
  .ship .wide { grid-column: 1 / -1; }
  .ship input, .act input:not([type]), .act input[type="number"] {
    padding: 8px 10px; border: 1px solid var(--color-hairline);
    border-radius: 8px; background: var(--color-surface-1); font-size: 13px;
  }
  .warn { margin: 0 0 10px; font-size: 12.5px; color: #8a5a05; }
  .eitem { display: flex; gap: 8px; flex-basis: 100%; }
  .btns { display: flex; flex-direction: column; gap: 6px; }
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

  select, input[type="datetime-local"], input[type="date"] {
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
