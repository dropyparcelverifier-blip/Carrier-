<script lang="ts">
  /**
   * GUARDRAIL 5 — the highest-risk element on the page.
   *
   * The Next version put origin, a percentage pill and destination on ONE
   * line. With a real value like "DotConnects Logistics USA Warehouse —
   * Newark, NJ" on a 360px screen, and truncation that only started at
   * 640px, that was almost certainly the overflow nobody could name.
   *
   * Below 640px this is a COLUMN. Cities stack above the track, never
   * beside it.
   *
   * The marker is also CLAMPED to 6-94%. Unclamped, 0% or 100% puts half
   * the marker outside the track before its label is even considered.
   */
  let { origin = "", destination = "", progress = 0, mode = "Air Freight" } = $props();

  // Never let the marker leave the track.
  const clamped = $derived(Math.min(94, Math.max(6, progress)));
</script>

<div class="route">
  <div class="ends">
    <div class="end">
      <span class="lbl">From</span>
      <span class="place truncate">{origin}</span>
    </div>
    <div class="end to">
      <span class="lbl">To</span>
      <span class="place truncate">{destination}</span>
    </div>
  </div>

  <div class="track">
    <div class="fill" style="width: {clamped}%"></div>
    <span class="marker" style="left: {clamped}%"></span>
  </div>

  <div class="meta">
    <span>{mode}</span>
    <span class="pct">{progress}%</span>
  </div>
</div>

<style>
  .route { display: flex; flex-direction: column; gap: 10px; }

  /* Column below 640px — guardrail 5 */
  .ends { display: flex; flex-direction: column; gap: 8px; }
  .end { display: flex; flex-direction: column; min-width: 0; }
  .lbl {
    font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--color-ink-tertiary);
  }
  .place { font-size: 15px; font-weight: 600; color: var(--color-ink); }

  .track {
    position: relative;
    height: 4px;
    border-radius: 2px;
    background: var(--color-surface-3);
    /* clip, not hidden — hidden would create a scroll container */
    overflow-x: clip;
  }
  .fill {
    height: 100%;
    border-radius: 2px;
    background: var(--color-semantic-info);
    transition: width 0.6s ease;
  }
  .marker {
    position: absolute;
    top: 50%;
    width: 12px; height: 12px;
    margin-left: -6px; margin-top: -6px;
    border-radius: 50%;
    background: var(--color-semantic-info);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-semantic-info) 22%, transparent);
    transition: left 0.6s ease;
  }

  .meta {
    display: flex; justify-content: space-between;
    font-size: 12px; color: var(--color-ink-subtle);
  }
  .pct { font-weight: 600; color: var(--color-semantic-info); }

  @media (min-width: 640px) {
    .ends { flex-direction: row; justify-content: space-between; }
    .to { align-items: flex-end; text-align: right; }
  }
</style>
