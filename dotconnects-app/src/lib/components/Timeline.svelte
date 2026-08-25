<script lang="ts">
  /**
   * D6 (Gate 5): the customer sees COMPLETED and CURRENT stages only.
   *
   * No greyed future rows, no predicted dates. Every per-stage date here
   * refers to something that already happened. A predicted date reads as
   * a promise, and the single arrival estimate in the status card is the
   * only forward-looking claim we make.
   *
   * Heading is "Journey so far", not "Journey" — a list that stops must
   * read as accurate rather than truncated.
   */
  type Event = {
    stage: string; label: string; location?: string;
    timestamp: string; state: string; note?: string;
  };
  let { events = [] as Event[] } = $props();

  const shown = $derived(events.filter((e) => e.state !== "pending"));
</script>

{#if shown.length === 0}
  <p class="empty">No movement recorded yet.</p>
{:else}
  <ol>
    {#each shown as e, i}
      <li class:current={e.state === "current"}>
        <span class="rail">
          <span class="dot" class:now={e.state === "current"}></span>
          {#if i < shown.length - 1}<span class="line"></span>{/if}
        </span>
        <span class="body">
          <span class="label">{e.label}</span>
          {#if e.timestamp}<span class="when">{e.timestamp}</span>{/if}
          {#if e.location}<span class="where truncate">{e.location}</span>{/if}
          {#if e.note}<span class="note">{e.note}</span>{/if}
        </span>
      </li>
    {/each}
  </ol>
{/if}

<style>
  ol { list-style: none; margin: 0; padding: 0; }
  li { display: flex; gap: 12px; padding-bottom: 16px; }
  li:last-child { padding-bottom: 0; }

  .rail { display: flex; flex-direction: column; align-items: center; width: 20px; flex-shrink: 0; }
  .dot {
    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
    background: var(--color-semantic-success);
  }
  .dot.now {
    width: 12px; height: 12px;
    background: var(--color-primary);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 22%, transparent);
  }
  .line { width: 2px; flex: 1; background: var(--color-hairline); margin-top: 4px; }

  .body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .label { font-size: 14px; color: var(--color-ink); }
  li.current .label { font-weight: 600; }
  .when, .where, .note { font-size: 12px; color: var(--color-ink-subtle); }
  .note { color: var(--color-ink-tertiary); }
  .empty { margin: 0; font-size: 13px; color: var(--color-ink-subtle); }
</style>
