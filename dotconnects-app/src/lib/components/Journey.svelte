<script lang="ts">
  import { STAGE_PHASE, type StageKey } from "$lib/types";

  /**
   * Tracking updates.
   *
   * Structure follows what Shiprocket and Velocity actually ship, because
   * both solved this before us and their pattern is better than the one
   * invented here first:
   *
   *   - DATE IN A LEFT COLUMN. Scanning chronology down a fixed column is
   *     far easier than reading it inline at the end of each line.
   *   - ACTIVITY IS THE HEADLINE, location underneath. An earlier version
   *     inverted this on the theory that "Airspace over the Atlantic"
   *     tells a customer more than "In transit". Two production courier
   *     UIs disagree, and they have more evidence than the theory did.
   *   - COLLAPSED BY DEFAULT. A 12-row log is a wall; the recent few are
   *     what anyone actually reads.
   */

  type Event = {
    stage: string; label: string; location?: string;
    timestamp: string; state: string; note?: string; carrier?: string;
  };

  let { events = [] as Event[], initial = 5 } = $props();

  let expanded = $state(false);

  // Newest first — same as both couriers, and the recent update is the
  // one being looked for.
  const shown = $derived(events.filter((e) => e.state !== "pending").reverse());
  const visible = $derived(expanded ? shown : shown.slice(0, initial));
  const hidden = $derived(shown.length - visible.length);

  /** "22 Aug 2026, 13:55 IST" -> { date: "22 Aug", time: "13:55" } */
  function split(ts: string) {
    if (!ts) return { date: "", time: "" };
    const [d = "", t = ""] = ts.split(",").map((x) => x.trim());
    const parts = d.split(" ");
    return {
      date: parts.slice(0, 2).join(" "),
      time: t.replace(/\s*IST$/, ""),
    };
  }
</script>

{#if shown.length === 0}
  <p class="empty">Nothing recorded yet. Updates appear here as your parcel moves.</p>
{:else}
  <ol>
    {#each visible as e, i}
      {@const now = i === 0}
      {@const when = split(e.timestamp)}
      <li class:now>
        <div class="when">
          <span class="date">{when.date}</span>
          <span class="time">{when.time}</span>
        </div>

        <div class="rail" aria-hidden="true">
          <span class="dot" class:now></span>
          {#if i < visible.length - 1}<span class="line"></span>{/if}
        </div>

        <div class="what">
          <span class="act">{e.label}</span>
          {#if e.location}<span class="loc">{e.location}</span>{/if}
          {#if e.carrier}<span class="via">via {e.carrier}</span>{/if}
          {#if e.note}<span class="note">{e.note}</span>{/if}
          <span class="phase">{STAGE_PHASE[e.stage as StageKey] ?? ""}</span>
        </div>
      </li>
    {/each}
  </ol>

  {#if hidden > 0}
    <button class="more" onclick={() => (expanded = true)}>
      Show {hidden} earlier {hidden === 1 ? "update" : "updates"}
      <span aria-hidden="true">⌄</span>
    </button>
  {:else if expanded && shown.length > initial}
    <button class="more" onclick={() => (expanded = false)}>
      Show less <span aria-hidden="true">⌃</span>
    </button>
  {/if}
{/if}

<style>
  ol { list-style: none; margin: 0; padding: 0; }

  li {
    display: grid;
    grid-template-columns: 62px 14px minmax(0, 1fr);
    gap: 0 12px;
    padding-bottom: 20px;
  }
  li:last-child { padding-bottom: 0; }

  /* Left date column — the scanning aid */
  .when { display: flex; flex-direction: column; text-align: right; padding-top: 1px; }
  .date {
    font-size: 12px; font-weight: 600;
    color: var(--color-ink-muted);
    font-variant-numeric: tabular-nums;
  }
  .time {
    font-size: 11px; color: var(--color-ink-tertiary);
    font-variant-numeric: tabular-nums;
  }
  li.now .date { color: var(--color-primary); }

  .rail { display: flex; flex-direction: column; align-items: center; }
  .dot {
    width: 9px; height: 9px; margin-top: 4px;
    border-radius: 50%; flex-shrink: 0;
    background: var(--color-hairline-strong);
  }
  .dot.now {
    background: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);
  }
  .line { width: 1.5px; flex: 1; margin-top: 4px; background: var(--color-hairline); }

  .what { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .act { font-size: 14px; font-weight: 500; color: var(--color-ink); line-height: 1.35; }
  li.now .act { font-weight: 600; }
  .loc { font-size: 13px; color: var(--color-ink-subtle); line-height: 1.4; text-wrap: pretty; }
  .via { font-size: 12px; color: var(--color-ink-tertiary); font-style: italic; }
  .note { font-size: 12px; color: var(--color-ink-tertiary); }
  .phase {
    margin-top: 3px;
    font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--color-ink-tertiary);
  }

  .more {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    width: 100%; margin-top: 4px; padding: 11px;
    border: 0; border-top: 1px solid var(--color-hairline);
    background: none; cursor: pointer;
    font-size: 13px; font-weight: 500; color: var(--color-primary);
  }
  .more:hover { color: var(--color-primary-hover); }

  .empty { margin: 0; font-size: 13px; color: var(--color-ink-subtle); }
</style>
