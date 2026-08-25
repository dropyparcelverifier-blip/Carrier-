<script lang="ts">
  /**
   * GUARDRAIL 1 + 2 (design §3b).
   *
   * Edge-to-edge below 640px: negative margin, hairline top/bottom, no
   * side borders. Card padding plus page padding eats horizontal space
   * TWICE, and that double-squeeze is what caused the clipping this
   * rebuild exists to fix.
   *
   * Rounded with margins from 640px up, where there's room to spare.
   */
  let { title = "", children } = $props();
</script>

<section class="card">
  {#if title}<h3>{title}</h3>{/if}
  <div class="body"><!--
 -->{@render children()}</div>
</section>

<style>
  .card {
    margin: 0 -16px;
    border-top: 1px solid var(--color-hairline);
    border-bottom: 1px solid var(--color-hairline);
    background: var(--color-surface-1);
  }
  h3 {
    margin: 0;
    padding: 12px 16px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink-tertiary);
    border-bottom: 1px solid var(--color-hairline);
  }
  .body { padding: 16px; }

  @media (min-width: 640px) {
    .card {
      margin: 0;
      border: 1px solid var(--color-hairline);
      border-radius: 16px;
      overflow: hidden;
    }
    h3 { padding: 12px 24px; }
    .body { padding: 24px; }
  }
</style>
