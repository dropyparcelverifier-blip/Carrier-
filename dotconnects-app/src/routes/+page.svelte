<script lang="ts">
  import Journey from "$lib/components/Journey.svelte";
  import Crossing from "$lib/components/Crossing.svelte";
  import { copyText } from "$lib/copy-text";
  import { bookingId } from "$lib/booking-id";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { COMPANY } from "$lib/company";

  /**
   * Customer tracking.
   *
   * The job of this page is to answer one question — where is my parcel
   * and when does it arrive — and to make a twelve-day silence feel
   * accounted for rather than empty.
   *
   * Design: paper, not dashboard. The canvas is a warm off-white and the
   * page carries no card chrome, no gradients and no shadows. Structure
   * comes from hairline rules and space. The one place boldness is spent
   * is the arrival date, because that is the answer.
   */

  let orderId = $state(page.url.searchParams.get("id") ?? "");
  let phoneInput = $state<HTMLInputElement | null>(null);

  /**
   * Arriving from a shared link (/tracking/TRK…), the id is already
   * filled, so the cursor belongs in the phone field. Without this the
   * customer taps a link and lands on a form whose first field is
   * already complete — a small thing that reads as broken.
   */
  onMount(() => {
    if (orderId) phoneInput?.focus();
  });
  let phone = $state(page.url.searchParams.get("phone") ?? "");
  let loading = $state(false);
  let error = $state("");
  let shipment = $state<any>(null);
  let copied = $state(false);

  const valid = $derived(orderId.trim().length > 0 && /^\d{10}$/.test(phone));

  async function track() {
    if (!valid || loading) return;
    loading = true; error = ""; shipment = null;
    try {
      const params = new URLSearchParams({ q: orderId.trim(), phone });
      const res = await fetch(`/api/track?${params}`);
      const json = await res.json();
      if (!res.ok) { error = json.error ?? "Something went wrong. Try again in a moment."; return; }
      if (!json.shipments?.length) {
        error = "No order matches those details. Check the order number, and use the phone number registered on the order.";
        return;
      }
      shipment = json.shipments[0];
    } catch {
      error = "Can't reach the server. Check your connection and try again.";
    } finally { loading = false; }
  }

  /* The ID goes bold for two seconds instead of showing an icon. */
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  async function copyId() {
    if (await copyText(shipment.id)) {
      copied = true;
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => (copied = false), 2000);
    }
  }

  function reset() { shipment = null; error = ""; }

  // Each of these needs its own answer. An overdue order has an EMPTY
  // eta by design, so without branching the biggest thing on the page
  // renders blank.
  const damaged = $derived(shipment?.status === "Damaged in transit");
  const overdue = $derived(shipment?.isOverdue === true);
  const forwarded = $derived(shipment?.status === "Forwarded to Courier");
  const cancelled = $derived(shipment?.status === "Cancelled");
  /* Set only when this parcel was damaged AND a replacement exists.
     The customer holding the original link is the one who needs it. */
  const replacedBy = $derived(shipment?.replacedByTrackingId ?? "");

  // "26 Aug 2026" -> day + month, year separately. The year is almost
  // never the useful part.
  /* The customer's own date, when there is one. Parsed the same way as
     the Vashi date so both render identically. */
  const doorstepParts = $derived.by(() => {
    const raw = shipment?.doorstepEta;
    if (!raw) return null;
    const m = String(raw).match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
    return m ? { day: m[1], month: m[2], year: m[3] } : { day: raw, month: "", year: "" };
  });

  const etaParts = $derived.by(() => {
    if (!shipment?.eta) return null;
    const m = String(shipment.eta).match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
    return m ? { day: m[1], month: m[2], year: m[3] } : { day: shipment.eta, month: "", year: "" };
  });

  /* Declared AFTER etaParts, which it reads. A $derived that references a
     later const is a temporal-dead-zone error the compiler does not
     always surface -- svelte-check did. */
  /* Which date is the headline. With a doorstep figure the big date is
     the customer's door and the warehouse drops to a waypoint line; with
     none, the card is exactly what it was before this existed. */
  const headline = $derived(doorstepParts ?? etaParts);
</script>

<svelte:head>
  <title>{shipment ? `${shipment.id} · DotConnects` : "Track your order · DotConnects"}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
  {#if !shipment}
    <div class="lookup">
      <h1>Where's my order?</h1>
      <p class="lede">Your order number and the phone number on the order.</p>

      <label>
        <span class="lbl">Order number</span>
        <!--
          The input does NOT transform what is typed.

          Two earlier attempts were both wrong. autocapitalize="characters"
          latched the Android keyboard into caps and left it there, so the
          phone number typed next also came out shifted. Uppercasing the
          value instead fixed the keyboard but broke Dropy order numbers,
          which are mixed case — "Dropy-3141" became "DROPY-3141".

          The real fix is in the QUERY, not the field: the lookup is
          case-insensitive now, so anything the customer types works and
          the field can leave their input alone.

          The placeholder says where to FIND the number, not what it looks
          like. A worked example would publish the id format to anyone who
          loads the page, and dropy_order_id is sequential — format plus
          sequence is an enumeration recipe. The phone check stops that
          working, but there is no reason to hand out the shape of the key.
        -->
        <input
          class="mono"
          bind:value={orderId}
          onkeydown={(e) => e.key === "Enter" && track()}
          placeholder="From your order confirmation"
          autocomplete="off" spellcheck="false" autocorrect="off"
        />
      </label>

      <label>
        <span class="lbl">Phone number</span>
        <input
          bind:this={phoneInput}
          bind:value={phone}
          oninput={(e) => (phone = e.currentTarget.value.replace(/\D/g, "").slice(0, 10))}
          onkeydown={(e) => e.key === "Enter" && track()}
          placeholder="10 digits"
          inputmode="numeric" autocomplete="tel"
        />
        <span class="help-text">The number you gave when ordering. It confirms the order is yours.</span>
      </label>

      {#if error}<p class="error" role="alert">{error}</p>{/if}

      <button class="go" onclick={track} disabled={!valid || loading}>
        {loading ? "Looking…" : "Track order"}
      </button>
    </div>
  {:else}
    <article>
      <!--
        Cards on a tinted page, following what Shiprocket and Velocity
        both ship. The separation genuinely helps: a customer scanning
        for one fact finds the right block instead of parsing a wall.

        Two columns from 900px. The answer and map stay put while the
        updates scroll beside them, so "when does it arrive" is never
        scrolled away from.
      -->
      <div class="lead">
        <!-- 1 · Delivery -->
        <section class="card rise">
          <div class="cardhead">
            <!-- DOT carries the US->India leg only. "Expected delivery"
                 read as the date the parcel reaches the customer's door;
                 it is the date it reaches the India warehouse, after
                 which an Indian courier takes several more days. Saying
                 so here is cheaper than answering it later. -->
            <span class="lbl">
              <!-- The label has to agree with the verdict under it. A
                   damaged parcel headed "Arriving at Dropy India Warehouse"
                   promises the arrival of a box that no longer exists. -->
              {#if cancelled && shipment.cancelledInFlight}Arriving at Dropy India warehouse
              {:else if cancelled}Order cancelled
              {:else if damaged}Damaged parcel
              {:else if forwarded}Handed to courier
              {:else if doorstepParts}Arriving at your address
              {:else}Arriving at Dropy India Warehouse{/if}
            </span>
            {#if cancelled}
              <span class="pill">Cancelled</span>
            {:else if damaged}
              <span class="pill alert">Damaged</span>
            {:else if overdue}
              <span class="pill warn">Delayed</span>
            {:else if forwarded}
              <span class="pill ok">Out for delivery</span>
            {/if}
          </div>

          {#if cancelled}
            <!-- No date, no progress, no next step. A cancelled parcel left
                 on a hopeful line is worse than no line at all. -->
            {#if shipment.cancelledInFlight && etaParts}
              <!-- Still flying. The box does not turn round because an
                   order was cancelled; it lands at Vashi and stops. The
                   arrival date is still a real fact, so it stays as the
                   headline and only its MEANING changes. -->
              <p class="date">
                <span class="d">{etaParts.day}</span>
                <span class="m">{etaParts.month}</span>
                {#if etaParts.year}<span class="y">{etaParts.year}</span>{/if}
              </p>
              <p class="waypoint">
                This order was cancelled, so the parcel stops at the Dropy
                India warehouse and won't be delivered onward.
              </p>
            {:else}
              <p class="verdict">This order was cancelled</p>
            {/if}
            {#if !shipment.cancelledInFlight}
              <!-- Nothing was ever in the air under this tracking. A
                   replacement is deliberately NOT offered here: cancelling
                   and then issuing a new tracking contradict each other.
                   Replacements belong to DAMAGED, where the box is gone
                   and something genuinely has to take its place. -->
              <p class="explain">
                The parcel isn't on its way to you. If you've already paid, a
                refund is being arranged and our team will be in touch.
              </p>
            {/if}
          {:else if damaged && replacedBy}
            <!-- The successor exists, so say so instead of ending here.
                 This link was stored all along and never shown, so a
                 customer following their original tracking hit a dead end. -->
            <p class="verdict">A replacement is on its way</p>
            <p class="explain">
              Your parcel was damaged before it reached India, so we've sent
              another one at no cost to you.
            </p>
            <a class="replacement" href="/?id={encodeURIComponent(replacedBy)}&phone={encodeURIComponent(shipment.customerMobile ?? '')}">
              Track the replacement →
            </a>
          {:else if damaged}
            <p class="verdict alert">We're sorting this out</p>
            <p class="explain">
              Your parcel was damaged on the way to India. Our team already
              knows and will contact you about a replacement.
            </p>
          {:else if overdue}
            <p class="verdict warn">Still on its way</p>
            <p class="explain">
              This is taking longer than our usual window. We're chasing it
              with our shipping partner — contact support for the latest.
            </p>
          {:else if forwarded}
            <p class="verdict">With the courier</p>
          {:else if headline}
            <p class="date">
              <span class="d">{headline.day}</span>
              <span class="m">{headline.month}</span>
              {#if headline.year}<span class="y">{headline.year}</span>{/if}
            </p>
            {#if doorstepParts && etaParts}
              <!-- One hero, one supporting line. Two large dates would
                   make the customer decide which one matters. The buffer
                   inside the figure is never shown or itemised. -->
              <!-- "our" was wrong: DotConnects is the forwarder, Dropy
                   India is the consignee it delivers TO. Claiming the
                   Dropy warehouse as ours reads as one company where the
                   customer is dealing with two. -->
              <p class="waypoint">
                Reaches the Dropy India warehouse in Mumbai on
                <b>{etaParts.day} {etaParts.month}</b>, then an Indian
                courier brings it to you.
              </p>
            {/if}
          {/if}

          <p class="statusline">
            <span class="k">Status</span>
            <span class="v">{shipment.status}</span>
          </p>

          {#if shipment.lastMileCourier}
            <div class="courier">
              <span class="badge">{shipment.lastMileCourier.slice(0, 2).toUpperCase()}</span>
              <span class="cmeta">
                <span class="cname">{shipment.lastMileCourier}</span>
                {#if shipment.lastMileTrackingUrl}
                  <a href={shipment.lastMileTrackingUrl} target="_blank" rel="noopener noreferrer">
                    {shipment.lastMileAwb ?? "Track with courier"} ↗
                  </a>
                {:else if shipment.lastMileAwb}
                  <span class="mono awb">{shipment.lastMileAwb}</span>
                {/if}
              </span>
            </div>
          {/if}
        </section>

        <!-- 2 · Order -->
        <section class="card split rise rise-2">
          <div>
            <span class="lbl">Booking ID</span>
            <span class="val mono">{bookingId(shipment.reference)}</span>
          </div>
          <div>
            <span class="lbl">Tracking ID</span>
            <!-- Tap to copy. The hidden bold copy underneath reserves the
                 wider width, so going bold never moves anything. -->
            <button class="copy mono" class:copied onclick={copyId} aria-label="Copy tracking ID {shipment.id}">
              <span class="face">{shipment.id}</span><span class="ghost" aria-hidden="true">{shipment.id}</span>
            </button>
            <span class="sr" aria-live="polite">{copied ? "Tracking ID copied" : ""}</span>
          </div>
          <div>
            <span class="lbl">Consignee Name</span>
            <span class="val">{shipment.consignee ? `Dropy India (${shipment.consignee})` : "Dropy India"}</span>
          </div>
          <div>
            <span class="lbl">Items</span>
            <span class="val">{shipment.totalItems} {shipment.totalItems === 1 ? "item" : "items"}</span>
          </div>
        </section>

        <!-- 3 · Route — hidden on a hold state.
             "No date, no progress, no next step" was honoured by the ETA
             card and by nothing else: a cancelled parcel still drew a
             flight path and a progress bar. It read as 0% only because
             that parcel had never moved; cancel one mid-journey and the
             customer gets "45% OF THE WAY" for a box that is not
             coming. -->
        <!-- Damaged stops the box; cancelled does not. A cancelled parcel
             keeps its map and its progress because both are still true,
             capped at the warehouse it is actually going to. -->
        {#if !damaged && (!cancelled || shipment.cancelledInFlight)}
          <section class="card rise rise-3">
            <h3>Route</h3>
            <Crossing
              origin={shipment.origin}
              destination={shipment.destination}
              progress={shipment.progress}
              mode={shipment.mode}
            />
          </section>
        {/if}
      </div>

      <div class="trail">
        <!-- 4 · Updates -->
        <section class="card rise rise-4">
          <h3>Tracking updates</h3>
          <Journey events={shipment.events ?? []} />
        </section>

        <!-- 5 · Help -->
        <section class="card help rise rise-5">
          <h3>Need help?</h3>
          <p>Email us about this order and we'll answer within four business hours.</p>
          <!-- From COMPANY, not hardcoded. This page is DotConnects-branded,
               so support@dropy.in was the wrong address to show — and a
               hardcoded one is the reason the domain was written eight
               different ways across two apps. -->
          <a class="mail" href="mailto:{COMPANY.email}?subject=Consignment%20{shipment.id}">
            {COMPANY.email}
          </a>
          <button class="another" onclick={reset}>Track a different consignment</button>
        </section>
      </div>
    </article>
  {/if}
</div>

<style>
  .page { max-width: 560px; margin: 0 auto; padding: 16px 16px 56px; }
  article { display: flex; flex-direction: column; gap: 12px; }
  .lead, .trail { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

  /* ── Lookup ────────────────────────────────────── */
  .lookup {
    display: flex; flex-direction: column; gap: 18px;
    padding: clamp(32px, 9vh, 72px) 4px 0;
  }
  h1 { font-size: clamp(26px, 7vw, 34px); line-height: 1.08; letter-spacing: -0.03em; margin: 0; }
  .lede { margin: -8px 0 4px; color: var(--color-ink-subtle); font-size: 15px; }

  label { display: flex; flex-direction: column; gap: 7px; }
  .lbl {
    font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--color-ink-tertiary);
  }
  .help-text { font-size: 12px; color: var(--color-ink-tertiary); line-height: 1.45; }

  input {
    width: 100%; padding: 14px 16px; font-size: 16px;
    color: var(--color-ink);
    background: var(--color-surface-1);
    border: 1.5px solid var(--color-hairline-strong);
    border-radius: 12px;
    transition: border-color 0.18s ease;
  }
  input::placeholder { color: var(--color-ink-tertiary); opacity: 0.7; }
  input:focus { outline: none; border-color: var(--color-primary); }

  .go {
    margin-top: 6px; padding: 15px 20px;
    border: 0; border-radius: 12px; cursor: pointer;
    background: var(--color-primary); color: #fff;
    font-family: var(--font-display); font-size: 15px; font-weight: 600;
    transition: background 0.18s ease, transform 0.1s ease;
  }
  .go:hover:not(:disabled) { background: var(--color-primary-hover); }
  .go:active:not(:disabled) { transform: translateY(1px); }
  .go:disabled { opacity: 0.35; cursor: default; }

  .error {
    margin: 0; padding: 12px 14px; border-radius: 10px;
    border: 1px solid var(--color-semantic-alert);
    background: color-mix(in srgb, var(--color-semantic-alert) 5%, transparent);
    font-size: 14px; line-height: 1.5; color: var(--color-ink-muted);
  }

  /* ── Cards ─────────────────────────────────────── */
  .card {
    padding: 18px;
    background: var(--color-surface-1);
    border: 1px solid var(--color-hairline);
    border-radius: 14px;
  }
  h3 {
    margin: 0 0 14px;
    font-family: var(--font-text);
    font-size: 11px; font-weight: 600; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--color-ink-tertiary);
  }

  .cardhead {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; margin-bottom: 6px;
  }
  .pill {
    padding: 3px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
    text-transform: uppercase; white-space: nowrap;
    color: var(--color-semantic-info);
    background: color-mix(in srgb, var(--color-semantic-info) 12%, transparent);
  }
  .pill.warn {
    color: var(--color-semantic-warn);
    background: color-mix(in srgb, var(--color-semantic-warn) 14%, transparent);
  }
  .pill.alert {
    color: var(--color-semantic-alert);
    background: color-mix(in srgb, var(--color-semantic-alert) 12%, transparent);
  }
  .pill.ok {
    color: var(--color-semantic-success);
    background: color-mix(in srgb, var(--color-semantic-success) 14%, transparent);
  }

  /* The answer. The only place boldness is spent. */
  .date {
    margin: 2px 0 0;
    font-family: var(--font-display);
    line-height: 0.94; letter-spacing: -0.045em;
    color: var(--color-primary);
    display: flex; align-items: baseline; flex-wrap: wrap; gap: 0 10px;
  }
  .date .d { font-size: clamp(40px, 12vw, 54px); font-weight: 700; }
  .date .m { font-size: clamp(24px, 7vw, 32px); font-weight: 600; }
  .date .y {
    font-size: 15px; font-weight: 500; letter-spacing: 0;
    color: var(--color-ink-tertiary);
  }

  .waypoint {
    margin: 12px 0 0; padding-top: 11px;
    border-top: 1px solid var(--color-hairline);
    font-size: 13px; line-height: 1.5; color: var(--color-ink-tertiary);
  }
  .waypoint b { color: var(--color-ink-muted); font-weight: 600; }

  .verdict {
    margin: 2px 0 0;
    font-family: var(--font-display);
    font-size: clamp(22px, 6vw, 28px); font-weight: 600;
    line-height: 1.15; letter-spacing: -0.025em;
    color: var(--color-ink);
  }
  .verdict.alert { color: var(--color-semantic-alert); }

  /* The way out of a damaged parcel. Sized as a real target, not a text
     link: on a phone this is the one thing the page is for. */
  .replacement {
    display: inline-block; margin-top: 14px;
    padding: 11px 18px; border-radius: 10px;
    background: var(--color-primary); color: #fff;
    font-size: 14px; font-weight: 600; text-decoration: none;
    min-height: 44px; line-height: 22px;
  }
  .replacement:hover { background: var(--color-primary-hover); }
  .replacement:focus-visible { outline: 2px solid var(--color-primary-focus); outline-offset: 3px; }
  @media (max-width: 520px) { .replacement { display: block; text-align: center; } }
  .verdict.warn { color: var(--color-semantic-warn); }
  .explain {
    margin: 10px 0 0; max-width: 44ch;
    font-size: 14px; line-height: 1.55; color: var(--color-ink-muted);
  }

  .statusline {
    display: flex; gap: 10px; align-items: baseline;
    margin: 16px 0 0; padding-top: 14px;
    border-top: 1px solid var(--color-hairline);
    font-size: 14px;
  }
  .k { font-size: 12px; color: var(--color-ink-tertiary); }
  .v { color: var(--color-ink); font-weight: 500; }

  .courier {
    display: flex; align-items: center; gap: 12px;
    margin-top: 14px; padding: 12px;
    background: var(--color-surface-2);
    border-radius: 10px;
  }
  .badge {
    display: grid; place-items: center;
    width: 38px; height: 38px; flex-shrink: 0;
    border-radius: 10px;
    background: var(--color-ink); color: var(--color-surface-1);
    font-family: var(--font-display); font-size: 13px; font-weight: 700;
  }
  .cmeta { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .cname { font-size: 14px; font-weight: 500; }
  .cmeta a, .awb { font-size: 13px; }
  .awb { color: var(--color-ink-subtle); }

  /* Order facts — two up, like Velocity's Order Id / Placed on card */
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .split > div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .val { font-size: 14px; color: var(--color-ink); word-break: break-word; }

  .copy {
    display: inline-grid; justify-items: start;
    padding: 0; border: 0; background: none; cursor: pointer;
    font-size: 14px; color: var(--color-ink); min-height: 0;
    text-align: left; word-break: break-all;
  }
  .copy > span { grid-area: 1 / 1; }
  .copy .ghost { visibility: hidden; font-weight: 700; }
  .copy.copied .face { font-weight: 700; }
  .copy:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; border-radius: 4px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  .help p {
    margin: 0 0 10px; font-size: 14px; line-height: 1.55;
    color: var(--color-ink-muted); max-width: 44ch;
  }
  .mail { font-size: 15px; font-weight: 500; }

  /* Was in the page header, which the layout owns now. It belongs here
     anyway — it acts on the result you're looking at, not on the site. */
  .another {
    display: block; width: 100%; margin-top: 16px; padding: 11px;
    border: 1px solid var(--color-hairline-strong); border-radius: 10px;
    background: none; cursor: pointer;
    font-size: 13px; font-weight: 500; color: var(--color-ink-subtle);
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .another:hover { border-color: var(--color-primary); color: var(--color-primary); }

  /* ── Desktop ───────────────────────────────────── */
  @media (min-width: 900px) {
    .page { max-width: 1080px; padding: 24px 32px 72px; }

    article {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px 20px;
      align-items: start;
    }
    .lead { position: sticky; top: 24px; }
    .card { padding: 22px; }
  }

  @media (min-width: 1200px) {
    .page { max-width: 1200px; }
    article { gap: 14px 24px; }
  }
</style>
