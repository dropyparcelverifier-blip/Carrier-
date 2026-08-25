<script lang="ts">
  import { SECTIONS, type SectionKey } from "$lib/order-sections";
  import { onMount } from "svelte";

  /** Admin orders table — wireframe A2. Six tabs, seven columns, kebab. */

  let authed = $state<boolean | null>(null);
  let role = $state<"admin" | "staff">("staff");
  let username = $state(""), password = $state(""), loginError = $state("");

  let section = $state<SectionKey>("transit");
  let pageNum = $state(1);
  let search = $state("");
  let data = $state<any>(null);
  let loading = $state(false);
  let error = $state("");

  // Guards against a slow earlier request landing after a faster later one
  // and painting stale rows — switching tabs quickly is exactly when that
  // happens, and the symptom looks like a backend bug.
  let seq = 0;
  let debounce: ReturnType<typeof setTimeout>;

  onMount(async () => {
    const res = await fetch("/api/admin/me");
    if (res.ok) {
      const me = await res.json();
      role = me.role; authed = true; load();
    } else authed = false;
  });

  async function login() {
    loginError = "";
    const res = await fetch("/api/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const j = await res.json();
    if (!j.ok) { loginError = j.error ?? "Login failed"; return; }
    const me = await (await fetch("/api/admin/me")).json();
    role = me.role; authed = true; password = ""; load();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    authed = false; data = null;
  }

  async function load() {
    const mine = ++seq;
    loading = true; error = "";
    try {
      const p = new URLSearchParams({ section, page: String(pageNum) });
      if (search.trim()) p.set("q", search.trim());
      const res = await fetch(`/api/admin/orders?${p}`);
      const j = await res.json();
      if (mine !== seq) return; // superseded
      if (!res.ok) { error = j.error ?? "Failed to load"; return; }
      data = j;
    } catch {
      if (mine === seq) error = "Couldn't reach the server.";
    } finally {
      if (mine === seq) loading = false;
    }
  }

  function onSearch() {
    clearTimeout(debounce);
    pageNum = 1;
    debounce = setTimeout(load, 300);
  }

  function pick(s: SectionKey) { section = s; pageNum = 1; load(); }
  function go(n: number) { pageNum = n; load(); }

  let openMenu = $state<string | null>(null);
  let confirming = $state<string | null>(null);

  async function del(id: string) {
    if (confirming !== id) { confirming = id; return; }
    const res = await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
    openMenu = null; confirming = null;
    if (res.ok) load();
  }

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
</script>

<svelte:head><title>Admin · DotConnects</title><meta name="robots" content="noindex" /></svelte:head>

{#if authed === null}
  <p class="center">Loading…</p>
{:else if !authed}
  <div class="login">
    <h1>Admin login</h1>
    <input bind:value={username} placeholder="Username" autocomplete="username" />
    <input bind:value={password} type="password" placeholder="Password"
           autocomplete="current-password" onkeydown={(e) => e.key === "Enter" && login()} />
    {#if loginError}<p class="err">{loginError}</p>{/if}
    <button class="primary" onclick={login}>Sign in</button>
  </div>
{:else}
  <div class="bar">
    <strong>Orders</strong>
    <span class="who">{role}</span>
    <button onclick={load}>Refresh</button>
    <button onclick={logout}>Log out</button>
  </div>

  <main>
    <input class="search" bind:value={search} oninput={onSearch}
           placeholder="Search tracking ID, order ID, name or phone…" />

    <div class="tabs">
      {#each SECTIONS as s}
        <button class:active={s.key === section} onclick={() => pick(s.key)}>
          {s.label}<span class="count">{data?.counts?.[s.key] ?? 0}</span>
        </button>
      {/each}
    </div>

    {#if error}<p class="err">{error}</p>{/if}

    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Created</th><th>Order ID</th><th>Tracking ID</th>
            <th>Name</th><th>Phone</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {#if loading && !data?.orders?.length}
            <tr><td colspan="7" class="empty">Loading…</td></tr>
          {:else if !data?.orders?.length}
            <tr><td colspan="7" class="empty">
              {search ? `No orders match "${search}"` : "No orders in this section"}
            </td></tr>
          {:else}
            {#each data.orders as o}
              <tr>
                <td class="dim nowrap">{fmt(o.created_at)}</td>
                <td class="mono">{o.dropy_order_id}</td>
                <td class="mono dim">{o.tracking_id}</td>
                <td class="name">{o.customer_name}</td>
                <td class="mono dim">{o.customer_mobile}</td>
                <td><span class="pill {o.section}">{o.live_status ?? o.status}</span></td>
                <td class="act">
                  <button class="kebab" onclick={() => { openMenu = openMenu === o.id ? null : o.id; confirming = null; }}>⋮</button>
                  {#if openMenu === o.id}
                    <!-- Rendered OUTSIDE the scroll container's clipping
                         context via position:fixed — an absolutely
                         positioned menu gets cut off at the table edge. -->
                    <div class="scrim" onclick={() => { openMenu = null; confirming = null; }}
                         role="presentation"></div>
                    <div class="menu">
                      <a href="/admin/{o.id}">View</a>
                      <a href="/admin/{o.id}">Edit</a>
                      {#if role === "admin"}
                        <button class="danger" onclick={() => del(o.id)}>
                          {confirming === o.id ? "Confirm delete?" : "Delete"}
                        </button>
                      {/if}
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    {#if data?.total > 0}
      <div class="pager">
        <span>{(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total}</span>
        <span class="nav">
          <button disabled={data.page <= 1} onclick={() => go(data.page - 1)}>‹ Prev</button>
          Page {data.page} of {data.totalPages}
          <button disabled={data.page >= data.totalPages} onclick={() => go(data.page + 1)}>Next ›</button>
        </span>
      </div>
    {/if}
  </main>
{/if}

<style>
  .center { text-align: center; padding: 48px; color: var(--color-ink-subtle); }

  .login { max-width: 340px; margin: 80px auto; display: flex; flex-direction: column; gap: 12px; padding: 0 16px; }
  .login h1 { font-size: 22px; text-align: center; margin-bottom: 8px; }
  .login input { padding: 12px 14px; border: 1.5px solid var(--color-hairline); border-radius: 10px; font-size: 16px; }

  .bar {
    position: sticky; top: 0; z-index: 30;
    display: flex; align-items: center; gap: 10px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--color-hairline);
    background: color-mix(in srgb, var(--color-canvas) 92%, transparent);
    backdrop-filter: blur(8px);
  }
  .bar .who {
    margin-right: auto; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--color-ink-tertiary);
  }
  .bar button, .pager button {
    padding: 6px 12px; border: 1px solid var(--color-hairline);
    border-radius: 8px; background: var(--color-surface-1);
    cursor: pointer; font-size: 13px; min-height: 0;
  }

  main { max-width: 1100px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }

  .search { padding: 10px 14px; border: 1px solid var(--color-hairline); border-radius: 10px; font-size: 14px; }

  .tabs { display: flex; gap: 2px; overflow-x: auto; border-bottom: 1px solid var(--color-hairline); }
  .tabs button {
    display: flex; align-items: center; gap: 6px; white-space: nowrap;
    padding: 10px 14px; border: 0; border-bottom: 2px solid transparent;
    background: none; cursor: pointer; font-size: 13px; font-weight: 600;
    color: var(--color-ink-subtle); min-height: 0;
  }
  .tabs button.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
  .count {
    padding: 1px 6px; border-radius: 10px; font-size: 11px; font-weight: 700;
    background: var(--color-surface-2); color: var(--color-ink-tertiary);
  }

  .scroll { overflow-x: auto; border: 1px solid var(--color-hairline); border-radius: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th {
    text-align: left; padding: 10px 12px; white-space: nowrap;
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--color-ink-subtle);
    border-bottom: 1px solid var(--color-hairline);
    background: var(--color-surface-1);
  }
  td { padding: 12px; border-bottom: 1px solid var(--color-hairline); }
  tr:last-child td { border-bottom: 0; }
  .dim { color: var(--color-ink-subtle); }
  .nowrap { white-space: nowrap; }
  .name { font-weight: 500; }
  .empty { text-align: center; padding: 40px 12px; color: var(--color-ink-subtle); }

  .pill {
    display: inline-block; white-space: nowrap;
    padding: 2px 10px; border-radius: 999px; border: 1px solid;
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    color: var(--color-semantic-info); border-color: var(--color-semantic-info);
  }
  .pill.ready { color: var(--color-semantic-warn); border-color: var(--color-semantic-warn); }
  .pill.delivered { color: var(--color-semantic-success); border-color: var(--color-semantic-success); }
  .pill.delayed, .pill.damaged { color: var(--color-semantic-alert); border-color: var(--color-semantic-alert); }
  .pill.picked { color: var(--color-primary); border-color: var(--color-primary); }

  .act { width: 44px; }
  .kebab {
    padding: 3px 8px; border: 1px solid var(--color-hairline);
    border-radius: 6px; background: none; cursor: pointer;
    font-size: 16px; line-height: 1; min-height: 0;
  }
  .scrim { position: fixed; inset: 0; z-index: 60; }
  .menu {
    position: fixed; z-index: 61; margin-top: 4px;
    right: 24px; min-width: 140px;
    border: 1px solid var(--color-hairline); border-radius: 10px;
    background: var(--color-surface-1); overflow: hidden;
    box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
  }
  .menu a, .menu button {
    display: block; width: 100%; text-align: left;
    padding: 10px 14px; border: 0; border-bottom: 1px solid var(--color-hairline);
    background: none; cursor: pointer; font-size: 13px;
    color: var(--color-ink); text-decoration: none; min-height: 0;
  }
  .menu :global(*:last-child) { border-bottom: 0; }
  .menu .danger { color: var(--color-semantic-alert); }

  .pager { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--color-ink-subtle); }
  .pager .nav { display: flex; align-items: center; gap: 8px; }
  .pager button:disabled { opacity: 0.4; cursor: default; }

  .primary {
    padding: 12px; border: 0; border-radius: 10px; cursor: pointer;
    background: var(--color-primary); color: #fff; font-weight: 600;
  }
  .err {
    margin: 0; padding: 10px 12px; border-radius: 8px;
    border: 1px solid var(--color-semantic-alert);
    color: var(--color-semantic-alert); font-size: 13px;
  }
</style>
