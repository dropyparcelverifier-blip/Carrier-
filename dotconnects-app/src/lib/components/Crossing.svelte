<script lang="ts">
  import { onMount } from "svelte";

  /**
   * The crossing.
   *
   * The map is shown on EVERY width — a parcel crossing an ocean is the
   * one thing worth drawing, and both Shiprocket and Velocity put a map
   * on their mobile tracking pages too.
   *
   * STILL LOADED DYNAMICALLY. lib/world-land.ts is a single
   * simplified-landmass SVG path at 25 kB gzipped, half again the weight
   * of this whole page. Loading it as a dynamic import means Vite
   * code-splits it, so it arrives AFTER first paint rather than blocking
   * it. On a slow connection the date and status render immediately and
   * the map fills in behind — which is the right order, because the date
   * is the answer and the map is the illustration.
   */

  let { origin = "", destination = "", progress = 0, mode = "Air Freight" } = $props();

  let land = $state<string | null>(null);

  // Equirectangular, matching lib/world-land.ts's 1000x500 space.
  const NEWARK = { x: 294, y: 137 };
  const MUMBAI = { x: 702, y: 197 };

  // Great-circle routes bow north on this projection, so the control
  // point sits well above both endpoints rather than between them.
  const ARC = `M${NEWARK.x} ${NEWARK.y} Q${(NEWARK.x + MUMBAI.x) / 2} 52 ${MUMBAI.x} ${MUMBAI.y}`;

  const clamped = $derived(Math.min(97, Math.max(3, progress)));

  // Point on the quadratic bezier at t — where the parcel is.
  const pos = $derived.by(() => {
    const t = clamped / 100;
    const cx = (NEWARK.x + MUMBAI.x) / 2, cy = 52;
    const u = 1 - t;
    return {
      x: u * u * NEWARK.x + 2 * u * t * cx + t * t * MUMBAI.x,
      y: u * u * NEWARK.y + 2 * u * t * cy + t * t * MUMBAI.y,
    };
  });

  onMount(() => {
    import("$lib/world-land").then((m) => (land = m.LAND_PATH));
  });
</script>

<div class="crossing">
  <div class="map-slot">
    {#if land}
    <svg class="map" viewBox="250 40 500 200" role="img"
         aria-label="{origin} to {destination}, {progress}% complete">
      <path class="land" d={land} fill-rule="evenodd" />
      <path class="route-bg" d={ARC} />
      <!-- pathLength is an SVG ATTRIBUTE, not a CSS property. Setting it to
           100 normalises the dash maths so --p is a plain percentage
           regardless of the arc's real length. -->
      <path class="route" d={ARC} pathLength="100" style="--p: {clamped}" />
      <circle class="pin" cx={NEWARK.x} cy={NEWARK.y} r="3.5" />
      <circle class="pin" cx={MUMBAI.x} cy={MUMBAI.y} r="3.5" />
      <circle class="parcel-halo" cx={pos.x} cy={pos.y} r="9" />
      <circle class="parcel" cx={pos.x} cy={pos.y} r="4.5" />
    </svg>
    {/if}
  </div>

  <div class="ends">
    <span class="place">{origin}</span>
    <span class="place to">{destination}</span>
  </div>

  <div class="bar" style="--p: {clamped}%">
    <span class="done"></span>
    <span class="dot"></span>
  </div>

  <div class="foot">
    <span>{mode}</span>
    <span class="pct">{progress}% of the way</span>
  </div>
</div>

<style>
  .crossing { display: flex; flex-direction: column; gap: 10px; }

  /* aspect-ratio reserves the space before the path arrives, so the
     content below doesn't jump when the chunk lands. */
  .map-slot {
    width: 100%;
    aspect-ratio: 500 / 200;
    margin-bottom: 6px;
    border-radius: 10px;
    overflow: hidden;
    background: var(--color-surface-2);
  }
  .map { width: 100%; height: 100%; display: block; }

  .land {
    fill: var(--color-surface-3);
    stroke: var(--color-hairline);
    stroke-width: 0.4;
  }
  .route-bg {
    fill: none;
    stroke: var(--color-hairline-strong);
    stroke-width: 1.2;
    stroke-dasharray: 3 4;
  }
  /* pathLength normalises the dash maths to 100 so --p is a plain
     percentage regardless of the arc's real length. */
  .route {
    fill: none;
    stroke: var(--color-primary);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-dasharray: 100;
    stroke-dashoffset: calc(100 - var(--p));
    transition: stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .pin { fill: var(--color-ink-tertiary); }
  .parcel { fill: var(--color-primary); }
  .parcel-halo { fill: var(--color-primary); opacity: 0.16; }

  @media (prefers-reduced-motion: no-preference) {
    .parcel-halo { animation: pulse 2.6s ease-in-out infinite; }
  }
  @keyframes pulse {
    0%, 100% { r: 9; opacity: 0.16; }
    50%      { r: 13; opacity: 0.06; }
  }

  .ends { display: flex; justify-content: space-between; gap: 16px; }
  .place { flex: 1; min-width: 0; font-size: 12px; line-height: 1.4; color: var(--color-ink-muted); }
  .place.to { text-align: right; }

  .bar {
    position: relative; height: 2px;
    background: var(--color-hairline-strong);
    overflow-x: clip;
  }
  .done {
    position: absolute; inset: 0 auto 0 0; width: var(--p);
    background: var(--color-primary);
    transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .dot {
    position: absolute; top: 50%; left: var(--p);
    width: 10px; height: 10px; margin: -5px 0 0 -5px;
    border-radius: 50%;
    background: var(--color-primary);
    box-shadow: 0 0 0 4px var(--color-canvas), 0 0 0 5px var(--color-primary);
    transition: left 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  }
  /* The map shows position; a second marker on a bar says it twice. The
     bar stays as a thin progress rule only, without its own dot. */
  .dot { display: none; }

  .foot {
    display: flex; justify-content: space-between;
    font-size: 11px; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--color-ink-tertiary);
  }
  .pct { color: var(--color-primary); font-weight: 600; }
</style>
