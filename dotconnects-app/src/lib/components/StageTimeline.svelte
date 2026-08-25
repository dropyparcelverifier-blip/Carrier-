<script lang="ts">
  import { STAGES, type StageKey } from "$lib/types";
  import { anchorFromRow, anchoredStageTime, etaAt } from "$lib/stage-clock";
  import { stageHappenedAt } from "$lib/order-routes";

  /**
   * Admin stage timeline — wireframe A3.
   *
   * Past and current stages with real timestamps, then FUTURE stages
   * greyed with predicted dates.
   *
   * The greyed rows are ADMIN-ONLY (D6). The customer sees completed and
   * current only, so every per-stage date they read refers to something
   * that already happened. Predictions here are decision support for the
   * operator — "should I push this forward?" — not a promise to anyone.
   */
  let {
    routeKey = null, orderDate, shippingDays, timingSeed = 0,
    currentStage, clockAnchorStage = null, clockAnchorAt = null,
    labelGeneratedAt = null, pickedUpAt = null, events = [] as any[],
  } = $props();

  const anchor = $derived(anchorFromRow(clockAnchorStage, clockAnchorAt));

  // Hold states sit outside the 0-100% timeline entirely, so there is no
  // "next stage" to predict for them.
  const held = $derived(currentStage === "damaged" || currentStage === "exception");

  const effective = $derived(
    pickedUpAt ? "handed_to_courier" : labelGeneratedAt ? "qc_check" : currentStage,
  );
  const currentIdx = $derived(STAGES.findIndex((s) => s.key === effective));
  const byStage = $derived(new Map(events.map((e: any) => [e.stage, e])));

  function realTime(stage: StageKey): Date | null {
    if (stage === "qc_check" && labelGeneratedAt) return new Date(labelGeneratedAt);
    if (stage === "handed_to_courier" && pickedUpAt) return new Date(pickedUpAt);
    const ev = byStage.get(stage);
    return ev?.happened_at ? new Date(ev.happened_at) : null;
  }

  function predicted(stage: StageKey): Date {
    return (
      anchoredStageTime(routeKey, stage, orderDate, shippingDays, anchor) ??
      stageHappenedAt(routeKey, stage, orderDate, shippingDays, timingSeed)
    );
  }

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
</script>

<ol>
  {#each STAGES as s, i}
    {@const past = currentIdx >= 0 && i < currentIdx}
    {@const now = i === currentIdx}
    {@const future = currentIdx >= 0 && i > currentIdx}
    {@const real = realTime(s.key)}
    {@const when = real ?? (future || held ? null : predicted(s.key))}
    <li class:future>
      <span class="rail">
        <span class="dot" class:now class:past class:future></span>
        {#if i < STAGES.length - 1}<span class="line" class:future></span>{/if}
      </span>
      <span class="body">
        <span class="head">
          <span class="label" class:now>{s.label}</span>
          {#if now}<span class="tag">← current</span>{/if}
          {#if real}<span class="ok">recorded</span>{/if}
        </span>
        <span class="when">
          <!-- qc_check and handed_to_courier are event-driven; the clock
               never reaches them on its own, so predicting a date would
               invent one. Say what actually triggers them instead. -->
          {#if future && s.key === "qc_check" && !real}
            when the label is generated
          {:else if future && s.key === "handed_to_courier" && !real}
            when the courier collects it
          {:else if when}
            {future ? "~" : ""}{fmt(when)}
          {:else}—{/if}
        </span>
        {#if byStage.get(s.key)?.note}
          <span class="note">{byStage.get(s.key).note}</span>
        {/if}
      </span>
    </li>
  {/each}
</ol>

{#if !held}
  <p class="foot">
    Greyed stages are predictions from this order's schedule — visible to you only.
    ETA {fmt(etaAt(orderDate, shippingDays))}.
  </p>
{/if}

<style>
  ol { list-style: none; margin: 0; padding: 0; }
  li { display: flex; gap: 12px; padding-bottom: 14px; }
  li:last-child { padding-bottom: 0; }
  li.future { opacity: 0.45; }

  .rail { display: flex; flex-direction: column; align-items: center; width: 20px; flex-shrink: 0; }
  .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; background: var(--color-semantic-success); }
  .dot.now {
    width: 12px; height: 12px; background: var(--color-primary);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 22%, transparent);
  }
  .dot.future { background: transparent; border: 2px solid var(--color-hairline-strong); }
  .line { width: 2px; flex: 1; background: var(--color-hairline); margin-top: 4px; }
  .line.future { opacity: 0.4; }

  .body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
  .label { font-size: 13px; }
  .label.now { font-weight: 600; }
  .tag { font-size: 11px; font-weight: 500; color: var(--color-primary); }
  .ok { font-size: 11px; color: var(--color-semantic-success); }
  .when, .note { font-size: 12px; color: var(--color-ink-subtle); }
  .note { color: var(--color-ink-tertiary); }
  .foot {
    margin: 10px 0 0; padding-top: 10px;
    border-top: 1px solid var(--color-hairline);
    font-size: 12px; color: var(--color-ink-tertiary);
  }
</style>
