<script lang="ts">
  import { onMount } from "svelte";
  import Card from "$lib/components/Card.svelte";

  /** Business enquiries from the marketing site. */

  const TABS = [
    { key: "open",        label: "Open" },
    { key: "in_progress", label: "In progress" },
    { key: "resolved",    label: "Resolved" },
    { key: "spam",        label: "Spam" },
  ] as const;

  let status = $state<string>("open");
  let queries = $state<any[]>([]);
  let counts = $state<Record<string, number>>({});
  let loading = $state(true);
  let error = $state("");
  let openId = $state<string | null>(null);
  let note = $state("");

  onMount(load);

  async function load() {
    loading = true; error = "";
    const res = await fetch(`/api/admin/queries?status=${status}`);
    if (!res.ok) { error = "Couldn't load enquiries."; loading = false; return; }
    const j = await res.json();
    queries = j.queries ?? []; counts = j.counts ?? {};
    loading = false;
  }

  function pick(s: string) { status = s; openId = null; load(); }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/queries/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const j = await res.json(); error = j.error ?? "Update failed."; return; }
    await load();
  }

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " +
    new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
</script>

<svelte:head><title>Enquiries · DotConnects Admin</title><meta name="robots" content="noindex" /></svelte:head>

<div class="top">
  <a href="/admin">← Orders</a>
  <strong>Enquiries</strong>
</div>

<main>
  {#if error}<p class="err">{error}</p>{/if}

  <div class="tabs">
    {#each TABS as t}
      <button class:active={t.key === status} onclick={() => pick(t.key)}>
        {t.label}<span class="n">{counts[t.key] ?? 0}</span>
      </button>
    {/each}
  </div>

  {#if loading}
    <p class="dim">Loading…</p>
  {:else if !queries.length}
    <Card><p class="dim">Nothing here.</p></Card>
  {:else}
    {#each queries as q}
      <Card>
        <button class="head" onclick={() => { openId = openId === q.id ? null : q.id; note = q.internal_note ?? ""; }}>
          <span class="biz">{q.business_name}</span>
          <span class="subj">{q.subject}</span>
          <span class="meta">
            {fmt(q.created_at)}
            {#if q.shared_at}<span class="shared">shared</span>{/if}
          </span>
        </button>

        {#if openId === q.id}
          <div class="detail">
            <p class="body">{q.body}</p>

            <dl class="facts">
              {#if q.contact_name}<div><dt>Contact</dt><dd>{q.contact_name}</dd></div>{/if}
              <div><dt>Email</dt><dd><a href="mailto:{q.email}?subject=Re: {q.subject}">{q.email}</a></dd></div>
              {#if q.phone}
                <div><dt>Phone</dt><dd>
                  <a href="tel:{q.phone}">{q.phone}</a>
                  · <a href="https://wa.me/{q.phone.replace(/\D/g,'')}" target="_blank" rel="noreferrer">WhatsApp</a>
                </dd></div>
              {/if}
              {#if q.business_desc}<div><dt>Business</dt><dd>{q.business_desc}</dd></div>{/if}
            </dl>

            <label class="note">
              <span>Internal note</span>
              <input bind:value={note} placeholder="Not shown to anyone outside the team" />
            </label>

            <div class="actions">
              {#each TABS as t}
                {#if t.key !== q.status}
                  <button onclick={() => patch(q.id, { status: t.key, internal_note: note })}>
                    Mark {t.label.toLowerCase()}
                  </button>
                {/if}
              {/each}
              <button class="share" onclick={() => patch(q.id, { shared: !q.shared_at })}>
                {q.shared_at ? "Unmark shared" : "Mark shared with carrier"}
              </button>
            </div>
          </div>
        {/if}
      </Card>
    {/each}
  {/if}
</main>

<style>
  .top {
    display: flex; align-items: center; gap: 14px;
    padding: 10px 16px; border-bottom: 1px solid var(--color-hairline);
    background: var(--color-surface-1); font-size: 14px;
  }
  main { max-width: 860px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }

  .tabs { display: flex; gap: 2px; overflow-x: auto; border-bottom: 1px solid var(--color-hairline); }
  .tabs button {
    display: flex; align-items: center; gap: 6px; white-space: nowrap;
    padding: 10px 14px; border: 0; border-bottom: 2px solid transparent;
    background: none; cursor: pointer; font-size: 13px; font-weight: 600;
    color: var(--color-ink-subtle); min-height: 0;
  }
  .tabs button.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
  .n { padding: 1px 6px; border-radius: 10px; font-size: 11px; background: var(--color-surface-2); }

  .head {
    display: flex; flex-direction: column; gap: 3px; width: 100%;
    padding: 0; border: 0; background: none; cursor: pointer; text-align: left; min-height: 0;
  }
  .biz { font-size: 15px; font-weight: 600; color: var(--color-ink); }
  .subj { font-size: 14px; color: var(--color-ink-muted); }
  .meta { display: flex; gap: 8px; font-size: 12px; color: var(--color-ink-tertiary); }
  .shared { color: var(--color-semantic-success); font-weight: 600; }

  .detail { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--color-hairline); }
  .body { margin: 0 0 14px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
  .facts { margin: 0 0 14px; display: flex; flex-direction: column; gap: 6px; }
  .facts > div { display: flex; gap: 12px; font-size: 13px; }
  dt { width: 72px; flex-shrink: 0; color: var(--color-ink-tertiary); }
  dd { margin: 0; }

  .note { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
  .note span { font-size: 12px; color: var(--color-ink-subtle); }
  .note input {
    padding: 9px 11px; font-size: 14px;
    border: 1px solid var(--color-hairline); border-radius: 8px;
    background: var(--color-surface-1);
  }

  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .actions button {
    padding: 7px 12px; border: 1px solid var(--color-hairline);
    border-radius: 8px; background: var(--color-surface-1);
    cursor: pointer; font-size: 12px; min-height: 0;
  }
  .actions button:hover { border-color: var(--color-primary); }
  .actions .share { color: var(--color-primary); }

  .dim { color: var(--color-ink-subtle); font-size: 14px; margin: 0; }
  .err { margin: 0; padding: 10px 12px; border-radius: 8px; font-size: 13px;
         border: 1px solid var(--color-semantic-alert); color: var(--color-semantic-alert); }
</style>
