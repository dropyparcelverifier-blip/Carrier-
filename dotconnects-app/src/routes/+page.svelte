<script lang="ts">
  import Card from "$lib/components/Card.svelte";
  import RouteBar from "$lib/components/RouteBar.svelte";
  import Timeline from "$lib/components/Timeline.svelte";
  import { copyText } from "$lib/copy-text";
  import { page } from "$app/state";

  /**
   * Customer tracking — C1 (single screen) + C2 (card sections).
   *
   * This is the ROOT of track.dotconnects.in, so the WhatsApp link is
   * just track.dotconnects.in/?id=USLMT... — no /track path segment to
   * explain.
   */

  let orderId = $state(page.url.searchParams.get("id") ?? "");
  let phone = $state("");
  let loading = $state(false);
  let error = $state("");
  let shipment = $state<any>(null);
  let copied = $state(false);

  const valid = $derived(orderId.trim().length > 0 && /^\d{10}$/.test(phone));

  async function track() {
    if (!valid) return;
    loading = true; error = ""; shipment = null;
    try {
      const params = new URLSearchParams({ q: orderId.trim(), phone });
      const res = await fetch(`/api/track?${params}`);
      const json = await res.json();
      if (!res.ok) { error = json.error ?? "Something went wrong."; return; }
      if (!json.shipments?.length) {
        error = "We couldn't find an order with those details. Check the order number and the phone number registered on the order.";
        return;
      }
      shipment = json.shipments[0];
    } catch {
      error = "Couldn't reach the server. Check your connection and try again.";
    } finally {
      loading = false;
    }
  }

  async function copyId() {
    if (await copyText(shipment.id)) {
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }

  // Hold states and overdue each need their own answer — see the Next
  // build's M7 notes. An overdue order has an EMPTY eta by design, so
  // without these branches the biggest number on the page renders blank.
  const damaged = $derived(shipment?.status === "Damaged in transit");
  const overdue = $derived(shipment?.isOverdue === true);
  const forwarded = $derived(shipment?.status === "Forwarded to Courier");
</script>

<svelte:head>
  <title>Track your order · DotConnects Logistics</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<header>
  <span class="logo">DC</span>
  <div>
    <div class="brand">DotConnects</div>
    <div class="sub">Logistics</div>
  </div>
  {#if shipment}
    <button class="link" onclick={() => { shipment = null; error = ""; }}>
      Track another
    </button>
  {/if}
</header>

<main>
  {#if !shipment}
    <!-- C1 — one screen, both fields -->
    <div class="search">
      <h1>Track your order</h1>
      <p class="lede">Enter your details to see where your parcel is</p>

      <label>
        <span>Order ID</span>
        <input
          class="mono"
          bind:value={orderId}
          placeholder="e.g. USLMT6V291D0045868"
          autocomplete="off"
          spellcheck="false"
        />
      </label>

      <label>
        <span>Registered phone number</span>
        <input
          bind:value={phone}
          oninput={(e) => (phone = e.currentTarget.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10-digit number"
          inputmode="numeric"
          autocomplete="tel"
        />
      </label>

      <details>
        <summary>Why we ask for your phone</summary>
        <p>Your phone number confirms this order is yours. We never share it or use it for marketing.</p>
      </details>

      {#if error}<p class="error">{error}</p>{/if}

      <button class="primary" onclick={track} disabled={!valid || loading}>
        {loading ? "Checking…" : "Track my order"}
      </button>
    </div>
  {:else}
    <div class="stack">
      <!-- 1 · Status & arrival -->
      <Card>
        {#if damaged}
          <p class="eyebrow alert">Damaged in transit</p>
          <p class="hero alert">We're sorting this out</p>
          <p class="explain">
            Your parcel was damaged on its way to India. Our team has already been
            notified and will contact you about a replacement.
          </p>
        {:else if overdue}
          <p class="eyebrow warn">Taking longer than expected</p>
          <p class="hero warn">Still on its way</p>
          <p class="explain">
            This parcel is taking longer than our usual window. We're chasing it
            with our shipping partner — please contact Dropy support for the
            latest update.
          </p>
        {:else if forwarded}
          <p class="eyebrow">Handed off to courier</p>
          <p class="hero">{shipment.status}</p>
          {#if shipment.lastMileTrackingUrl}
            <a class="courier" href={shipment.lastMileTrackingUrl} target="_blank" rel="noopener noreferrer">
              Delivery updates on {shipment.lastMileCourier} →
            </a>
          {/if}
        {:else}
          <p class="eyebrow">{shipment.status}</p>
          <p class="label-sm">Expected delivery</p>
          <p class="hero">{shipment.eta || "—"}</p>
        {/if}

        <div class="ids">
          <button class="idbtn" onclick={copyId}>
            <span class="k">Tracking</span>
            <span class="mono break-all">{shipment.id}</span>
            {#if copied}<span class="ok">copied</span>{/if}
          </button>
          <span class="idrow"><span class="k">Order</span> <span class="mono">{shipment.reference}</span></span>
          <span class="idrow"><span class="k">For</span> <span class="truncate">{shipment.consignee}</span></span>
        </div>
      </Card>

      <!-- 2 · Route -->
      <Card title="Route">
        <RouteBar
          origin={shipment.origin}
          destination={shipment.destination}
          progress={shipment.progress}
          mode={shipment.mode}
        />
      </Card>

      <!-- 3 · Journey so far -->
      <Card title="Journey so far">
        <Timeline events={shipment.events ?? []} />
      </Card>

      <!-- 4 · Need help — expanded, not an accordion -->
      <Card title="Need help?">
        <p class="help">Question about this shipment? Our team responds within 4 business hours.</p>
        <a class="btn" href="mailto:support@dropy.in">Email support</a>
      </Card>
    </div>
  {/if}
</main>

<style>
  header {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-hairline);
    background: var(--color-surface-1);
  }
  .logo {
    display: grid; place-items: center;
    width: 28px; height: 28px; border-radius: 6px;
    background: var(--color-primary); color: #fff;
    font-weight: 700; font-size: 13px;
  }
  .brand { font-weight: 600; font-size: 15px; }
  .sub { font-size: 12px; color: var(--color-ink-subtle); }
  header .link {
    margin-left: auto; background: none; border: 0; cursor: pointer;
    color: var(--color-primary); font-weight: 600; font-size: 14px;
  }

  main { max-width: 560px; margin: 0 auto; padding: 16px; }

  .search { display: flex; flex-direction: column; gap: 14px; padding-top: 24px; }
  h1 { font-size: 24px; font-weight: 600; text-align: center; }
  .lede { margin: 0 0 8px; text-align: center; color: var(--color-ink-subtle); font-size: 14px; }

  label { display: flex; flex-direction: column; gap: 6px; }
  label span { font-size: 13px; color: var(--color-ink-muted); }
  input {
    padding: 14px 16px; font-size: 16px;
    border: 1.5px solid var(--color-hairline); border-radius: 10px;
    background: var(--color-surface-1);
  }
  input:focus { outline: none; border-color: var(--color-primary); }

  details { font-size: 13px; color: var(--color-ink-subtle); }
  details summary { cursor: pointer; }
  details p { margin: 6px 0 0; line-height: 1.5; }

  .primary {
    padding: 14px 20px; border: 0; border-radius: 10px; cursor: pointer;
    background: var(--color-primary); color: #fff;
    font-weight: 600; font-size: 15px;
  }
  .primary:disabled { opacity: 0.45; cursor: default; }

  .error {
    margin: 0; padding: 12px 14px; border-radius: 10px;
    border: 1px solid var(--color-semantic-alert);
    color: var(--color-semantic-alert); font-size: 14px; line-height: 1.5;
  }

  .stack { display: flex; flex-direction: column; gap: 12px; }

  .eyebrow {
    margin: 0 0 4px; font-size: 11px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--color-semantic-info);
  }
  .eyebrow.alert, .hero.alert { color: var(--color-semantic-alert); }
  .eyebrow.warn, .hero.warn { color: var(--color-semantic-warn); }

  .label-sm { margin: 12px 0 2px; font-size: 13px; color: var(--color-ink-subtle); }
  .hero {
    margin: 0; font-size: 28px; font-weight: 700;
    letter-spacing: -0.02em; line-height: 1.15;
    color: var(--color-primary);
  }
  .explain { margin: 10px 0 0; font-size: 14px; color: var(--color-ink-muted); line-height: 1.55; }
  .courier { display: inline-block; margin-top: 10px; font-size: 13px; font-weight: 500; }

  /* GUARDRAIL 3 — stacked below 640px, never side by side */
  .ids {
    display: flex; flex-direction: column; gap: 8px;
    margin-top: 18px; padding-top: 14px;
    border-top: 1px solid var(--color-hairline);
    font-size: 13px;
  }
  .idbtn {
    display: flex; align-items: center; gap: 8px;
    background: none; border: 0; padding: 0; cursor: pointer;
    text-align: left; min-height: 44px;
  }
  .idrow { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .k { color: var(--color-ink-tertiary); flex-shrink: 0; }
  .ok { color: var(--color-semantic-success); font-size: 12px; }

  .help { margin: 0 0 12px; font-size: 14px; color: var(--color-ink-muted); }
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 0 16px; min-height: 44px;
    border: 1px solid var(--color-hairline-strong); border-radius: 12px;
    background: var(--color-surface-2);
    color: var(--color-ink-subtle); font-size: 14px; font-weight: 500;
    text-decoration: none;
  }
  .btn:hover { border-color: var(--color-primary); color: var(--color-ink); text-decoration: none; }
</style>
