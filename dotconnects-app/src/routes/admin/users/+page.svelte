<script lang="ts">
  import { onMount } from "svelte";
  import Card from "$lib/components/Card.svelte";

  /**
   * User management — admin only.
   *
   * The API rejects staff independently; this page just doesn't render
   * for them. Hiding a screen the server would refuse anyway is courtesy,
   * not protection.
   */

  let users = $state<any[]>([]);
  let role = $state<"admin" | "staff">("staff");
  let loading = $state(true);
  let error = $state(""), success = $state("");

  // New user form
  let username = $state(""), fullName = $state(""), password = $state("");
  let newRole = $state<"admin" | "staff">("staff");
  let creating = $state(false);
  let showForm = $state(false);

  onMount(async () => {
    const me = await fetch("/api/admin/me");
    if (me.ok) role = (await me.json()).role;
    await load();
  });

  async function load() {
    loading = true;
    const res = await fetch("/api/admin/users");
    if (res.status === 403) { error = "Admin role required."; loading = false; return; }
    if (res.ok) users = (await res.json()).users ?? [];
    loading = false;
  }

  async function create() {
    error = ""; success = ""; creating = true;
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, full_name: fullName, password, role: newRole }),
      });
      const j = await res.json();
      if (!res.ok) { error = j.error ?? "Couldn't create user."; return; }
      success = `Created ${username}.`;
      username = ""; fullName = ""; password = ""; newRole = "staff"; showForm = false;
      await load();
    } finally { creating = false; }
  }

  async function patch(id: string, body: Record<string, unknown>, label: string) {
    error = ""; success = "";
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    // The server refuses self-demotion, self-deactivation, and removing
    // the last admin. Those come back as 409 with a real explanation —
    // show it rather than a generic failure.
    if (!res.ok) { error = j.error ?? "Update failed."; return; }
    success = label;
    await load();
  }

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
</script>

<svelte:head><title>Users · DotConnects Admin</title><meta name="robots" content="noindex" /></svelte:head>

<div class="top">
  <a href="/admin">← Orders</a>
  <strong>Users</strong>
  {#if role === "admin"}
    <button class="primary" onclick={() => (showForm = !showForm)}>
      {showForm ? "Cancel" : "+ Add user"}
    </button>
  {/if}
</div>

<main>
  {#if error}<p class="err">⚠ {error}</p>{/if}
  {#if success}<p class="ok">{success}</p>{/if}

  {#if showForm}
    <Card title="New user">
      <div class="form">
        <label><span>Username</span>
          <input bind:value={username} placeholder="lowercase, 3–32 chars" autocomplete="off" />
        </label>
        <label><span>Full name</span>
          <input bind:value={fullName} placeholder="Priya Sharma" />
        </label>
        <label><span>Password</span>
          <input bind:value={password} type="password" placeholder="at least 10 characters" autocomplete="new-password" />
        </label>
        <label><span>Role</span>
          <select bind:value={newRole}>
            <option value="staff">Staff — daily work</option>
            <option value="admin">Admin — plus users, delete, seed</option>
          </select>
        </label>
      </div>
      <button class="primary wide" onclick={create}
              disabled={creating || !username || !fullName || password.length < 10}>
        {creating ? "Creating…" : "Create user"}
      </button>
    </Card>
  {/if}

  <Card title="Team">
    {#if loading}
      <p class="dim">Loading…</p>
    {:else if !users.length}
      <p class="dim">No users.</p>
    {:else}
      <div class="scroll">
        <table>
          <thead>
            <tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Added</th><th></th></tr>
          </thead>
          <tbody>
            {#each users as u}
              <tr class:off={!u.is_active}>
                <td class="name">{u.full_name}</td>
                <td class="mono dim">{u.username}</td>
                <td>
                  <span class="pill" class:admin={u.role === "admin"}>{u.role}</span>
                </td>
                <td>{u.is_active ? "Active" : "Deactivated"}</td>
                <td class="dim nowrap">{fmt(u.created_at)}</td>
                <td class="act">
                  {#if role === "admin"}
                    {#if u.role === "staff"}
                      <button onclick={() => patch(u.id, { role: "admin" }, `${u.username} is now admin.`)}>
                        Make admin
                      </button>
                    {:else}
                      <button onclick={() => patch(u.id, { role: "staff" }, `${u.username} is now staff.`)}>
                        Make staff
                      </button>
                    {/if}
                    {#if u.is_active}
                      <button class="danger"
                              onclick={() => patch(u.id, { is_active: false }, `${u.username} deactivated.`)}>
                        Deactivate
                      </button>
                    {:else}
                      <button onclick={() => patch(u.id, { is_active: true }, `${u.username} reactivated.`)}>
                        Reactivate
                      </button>
                    {/if}
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="hint">
        Users are deactivated, never deleted — deleting one would orphan every
        audit row pointing at them.
      </p>
    {/if}
  </Card>
</main>

<style>
  .top {
    display: flex; align-items: center; gap: 14px;
    padding: 10px 16px; border-bottom: 1px solid var(--color-hairline);
    background: var(--color-surface-1); font-size: 14px;
  }
  .top .primary { margin-left: auto; }

  main { max-width: 900px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }

  .form { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 14px; }
  label { display: flex; flex-direction: column; gap: 5px; }
  label span { font-size: 12px; color: var(--color-ink-subtle); }
  input, select {
    padding: 10px 12px; font-size: 15px;
    border: 1.5px solid var(--color-hairline); border-radius: 10px;
    background: var(--color-surface-1);
  }
  input:focus, select:focus { outline: none; border-color: var(--color-primary); }

  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th {
    text-align: left; padding: 8px 10px; white-space: nowrap;
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--color-ink-subtle);
    border-bottom: 1px solid var(--color-hairline);
  }
  td { padding: 10px; border-bottom: 1px solid var(--color-hairline); }
  tr:last-child td { border-bottom: 0; }
  tr.off { opacity: 0.5; }
  .name { font-weight: 500; }
  .dim { color: var(--color-ink-subtle); }
  .nowrap { white-space: nowrap; }
  .act { display: flex; flex-wrap: wrap; gap: 6px; }

  .pill {
    padding: 2px 9px; border-radius: 999px; border: 1px solid;
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    color: var(--color-ink-subtle); border-color: var(--color-hairline-strong);
  }
  .pill.admin { color: var(--color-primary); border-color: var(--color-primary); }

  button {
    padding: 6px 10px; border: 1px solid var(--color-hairline);
    border-radius: 8px; background: var(--color-surface-1);
    cursor: pointer; font-size: 12px; min-height: 0;
    transition: border-color 0.15s ease;
  }
  button:hover { border-color: var(--color-primary); }
  button.danger { color: var(--color-semantic-alert); }
  .primary {
    padding: 8px 14px; border: 0; border-radius: 8px;
    background: var(--color-primary); color: #fff; font-weight: 600; font-size: 13px;
  }
  .primary:hover { background: var(--color-primary-hover); }
  .primary:disabled { opacity: 0.45; cursor: default; }
  .primary.wide { width: 100%; padding: 12px; font-size: 14px; }

  .hint { margin: 12px 0 0; font-size: 12px; color: var(--color-ink-tertiary); }
  .err, .ok { margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 13px; border: 1px solid; }
  .err { color: var(--color-semantic-alert); border-color: var(--color-semantic-alert); }
  .ok { color: var(--color-semantic-success); border-color: var(--color-semantic-success); }

  @media (min-width: 640px) { .form { grid-template-columns: 1fr 1fr; } }
</style>
