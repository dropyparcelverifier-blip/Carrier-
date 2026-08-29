<script lang="ts">
  import { STAGE_CODE, STAGE_SHORT_LABEL, type StageKey } from "$lib/types";

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

  /**
   * Prose location -> code.
   *
   * "Newark Liberty Intl Airport (EWR), NJ" -> "EWR"
   * "Airspace — EWR to BOM nonstop (Air India Cargo)" -> "EWR → BOM"
   * "DotConnects Arrival Warehouse, Navi Mumbai" -> "BOM3"
   *
   * Falls back to the original string when nothing matches, so a
   * hand-entered override from the admin panel still shows as typed.
   */
  function shortPlace(loc: string): string {
    const airspace = loc.match(/Airspace — ([A-Z]{3}) to ([A-Z]{3})/);
    if (airspace) return `${airspace[1]} → ${airspace[2]}`;
    if (/Arrival Warehouse/i.test(loc)) return "BOM3";
    if (/Origin Warehouse/i.test(loc)) {
      const city = loc.split(",").slice(1).join(",").trim();
      return city || "Origin";
    }
    const code = loc.match(/\(([A-Z]{3})\)/);
    if (code) return code[1];
    if (/Air Cargo Complex|Sahar/i.test(loc)) {
      const c = loc.match(/(Mumbai|Delhi|Bengaluru|Chennai)/);
      return c ? `${c[1]} customs` : "Customs";
    }
    return loc;
  }

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
          <!-- LINE 1: what happened. Short form — "Departed origin", not
               "Shipped — departed origin". -->
          <span class="act">
            {STAGE_SHORT_LABEL[e.stage as StageKey] ?? e.label}
          </span>
          <!-- LINE 2: where, coded. A full airport name wraps to two
               lines on a phone; a three-letter code doesn't, and reads as
               operational data rather than prose. The phase tag that used
               to sit here is gone — a third line nobody read, when the
               grouping is already obvious from the order. -->
          <span class="loc">
            <span class="code">{STAGE_CODE[e.stage as StageKey] ?? ""}</span>
            {#if e.location}<span class="place">{shortPlace(e.location)}</span>{/if}
            {#if e.carrier}<span class="via">{e.carrier}</span>{/if}
          </span>
          {#if e.note}<span class="note">{e.note}</span>{/if}
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
  .loc {
    display: flex; align-items: baseline; flex-wrap: wrap; gap: 3px 8px;
    font-size: 13px; color: var(--color-ink-subtle); line-height: 1.4;
  }
  .code {
    font-family: var(--font-mono);
    font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
    padding: 1px 5px; border-radius: 4px;
    background: var(--color-surface-2);
    color: var(--color-ink-muted);
  }
  li.now .code { background: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary); }
  .place { min-width: 0; }
  .via { font-size: 12px; color: var(--color-ink-tertiary); }
  .note { font-size: 12px; color: var(--color-ink-tertiary); }

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
