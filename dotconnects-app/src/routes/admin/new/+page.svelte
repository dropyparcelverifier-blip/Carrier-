<script lang="ts">
  import Card from "$lib/components/Card.svelte";
  import { goto } from "$app/navigation";

  /** Manual order creation. The DOC bridge is the normal path; this is
      for the exceptions that never went through Order Central. */

  let f = $state({
    us_order_id: "", dropy_order_id: "",
    customer_name: "", customer_mobile: "", customer_email: "",
    customer_address: "", customer_city: "Mumbai", customer_pincode: "",
    shipping_days: "12", shipping_mode: "Air Freight",
    payment_status: "Unpaid", admin_notes: "",
  });

  let items = $state([{ name: "", qty: 1, weight_g: 0 }]);
  let busy = $state(false), error = $state(""), created = $state<any>(null);

  const valid = $derived(
    /^\d{3}-\d{7}-\d{7}$/.test(f.us_order_id.trim()) &&
    f.dropy_order_id.trim().length > 0 &&
    f.customer_name.trim().length > 0 &&
    /^\d{10}$/.test(f.customer_mobile.trim()) &&
    f.customer_city.trim().length > 0 &&
    items.some((i) => i.name.trim()),
  );

  function addItem() { items = [...items, { name: "", qty: 1, weight_g: 0 }]; }
  function removeItem(i: number) { items = items.filter((_, n) => n !== i); }

  async function save() {
    error = ""; busy = true;
    try {
      const res = await fetch("/api/admin/orders/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          shipping_days: Number(f.shipping_days),
          items: items.filter((i) => i.name.trim()),
        }),
      });
      const j = await res.json();
      if (!res.ok) { error = j.error ?? "Couldn't create the order."; return; }
      created = j.order;
    } catch { error = "Couldn't reach the server."; }
    finally { busy = false; }
  }
</script>

<svelte:head><title>New order · DotConnects Admin</title><meta name="robots" content="noindex" /></svelte:head>

<div class="top">
  <a href="/admin">← Orders</a>
  <strong>New order</strong>
</div>

<main>
  {#if created}
    <Card title="Order created">
      <p class="big mono">{created.tracking_id}</p>
      <p class="dim">{created.dropy_order_id} · {created.customer_name}</p>
      <div class="row">
        <button class="primary" onclick={() => goto(`/admin/${created.id}`)}>Open order</button>
        <button onclick={() => location.reload()}>Create another</button>
      </div>
    </Card>
  {:else}
    {#if error}<p class="err">⚠ {error}</p>{/if}

    <Card title="Order">
      <div class="grid">
        <label><span>US order ID</span>
          <input class="mono" bind:value={f.us_order_id} placeholder="123-4567890-1234567" />
          <!-- Shape only, never a real order. Page JS is served to anyone
               who requests it, logged in or not, so a real id in a
               placeholder is a public one. -->
          <em>Amazon format. The tracking ID is generated from this.</em>
        </label>
        <label><span>Dropy order ID</span>
          <input class="mono" bind:value={f.dropy_order_id} placeholder="Dropy-0000" />
        </label>
        <label><span>Shipping days</span>
          <input type="number" min="1" max="30" bind:value={f.shipping_days} />
          <em>Drives the whole clock. 12 is standard.</em>
        </label>
        <label><span>Mode</span>
          <select bind:value={f.shipping_mode}>
            <option>Air Freight</option><option>Express Air</option>
          </select>
        </label>
      </div>
    </Card>

    <Card title="Customer">
      <div class="grid">
        <label><span>Name</span><input bind:value={f.customer_name} /></label>
        <label><span>Mobile</span>
          <input bind:value={f.customer_mobile} inputmode="numeric"
                 oninput={(e) => (f.customer_mobile = e.currentTarget.value.replace(/\D/g, "").slice(0, 10))}
                 placeholder="10 digits" />
          <em>This is what the customer types to see their order.</em>
        </label>
        <label><span>City</span><input bind:value={f.customer_city} /></label>
        <label><span>Pincode</span><input bind:value={f.customer_pincode} /></label>
        <label class="wide"><span>Address</span><input bind:value={f.customer_address} /></label>
        <label><span>Email</span><input bind:value={f.customer_email} type="email" /></label>
        <label><span>Payment</span>
          <select bind:value={f.payment_status}>
            <option>Unpaid</option><option>Paid</option><option>COD</option><option>Refunded</option>
          </select>
        </label>
      </div>
    </Card>

    <Card title="Items">
      {#each items as item, i}
        <div class="item">
          <input bind:value={item.name} placeholder="Product name" />
          <input type="number" min="1" bind:value={item.qty} placeholder="Qty" class="sm" />
          <input type="number" min="0" bind:value={item.weight_g} placeholder="Grams" class="sm" />
          {#if items.length > 1}
            <button class="x" onclick={() => removeItem(i)} aria-label="Remove">×</button>
          {/if}
        </div>
      {/each}
      <button onclick={addItem}>+ Add item</button>
    </Card>

    <Card title="Internal">
      <label><span>Admin notes</span>
        <input bind:value={f.admin_notes} placeholder="Never shown to the customer" />
      </label>
    </Card>

    <button class="primary wide" onclick={save} disabled={busy || !valid}>
      {busy ? "Creating…" : "Create order"}
    </button>
    {#if !valid}
      <p class="hint">
        Needs a valid US order ID, Dropy ID, name, 10-digit mobile, city, and at
        least one item.
      </p>
    {/if}
  {/if}
</main>

<style>
  .top {
    display: flex; align-items: center; gap: 14px;
    padding: 10px 16px; border-bottom: 1px solid var(--color-hairline);
    background: var(--color-surface-1); font-size: 14px;
  }
  main { max-width: 780px; margin: 0 auto; padding: 16px 16px 40px; display: flex; flex-direction: column; gap: 12px; }

  .grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  label { display: flex; flex-direction: column; gap: 5px; }
  label span { font-size: 12px; color: var(--color-ink-subtle); }
  label em { font-size: 11px; color: var(--color-ink-tertiary); font-style: normal; }
  input, select {
    padding: 10px 12px; font-size: 15px;
    border: 1.5px solid var(--color-hairline); border-radius: 10px;
    background: var(--color-surface-1); width: 100%;
  }
  input:focus, select:focus { outline: none; border-color: var(--color-primary); }

  .item { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
  .item .sm { width: 88px; flex-shrink: 0; }
  .x {
    width: 34px; padding: 0; flex-shrink: 0;
    border: 1px solid var(--color-hairline); border-radius: 8px;
    background: none; cursor: pointer; color: var(--color-semantic-alert);
    font-size: 18px; line-height: 1; min-height: 38px;
  }

  button {
    padding: 8px 14px; border: 1px solid var(--color-hairline);
    border-radius: 10px; background: var(--color-surface-1);
    cursor: pointer; font-size: 13px; min-height: 0;
  }
  .primary {
    border: 0; background: var(--color-primary); color: #fff; font-weight: 600;
  }
  .primary:hover { background: var(--color-primary-hover); }
  .primary:disabled { opacity: 0.45; cursor: default; }
  .primary.wide { width: 100%; padding: 14px; font-size: 15px; }

  .row { display: flex; gap: 10px; margin-top: 14px; }
  .big { font-size: 20px; font-weight: 600; margin: 0 0 4px; }
  .dim { color: var(--color-ink-subtle); margin: 0; }
  .hint { margin: 0; font-size: 12px; color: var(--color-ink-tertiary); text-align: center; }
  .err { margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 13px;
         border: 1px solid var(--color-semantic-alert); color: var(--color-semantic-alert); }

  @media (min-width: 640px) {
    .grid { grid-template-columns: 1fr 1fr; }
    .wide { grid-column: 1 / -1; }
  }
</style>
