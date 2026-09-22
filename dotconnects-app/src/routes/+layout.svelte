<script lang="ts">
  // Font files first — imported as modules so Vite resolves them from
  // node_modules. @import inside a .css file does NOT do this; PostCSS
  // reads the specifier as a relative file path.
  import "@fontsource-variable/sora";
  import "@fontsource-variable/inter";
  import "@fontsource-variable/jetbrains-mono";
  import "@fontsource/instrument-serif/400-italic.css";

  import "$lib/styles/fonts.css";
  import "$lib/styles/tokens.css";
  import "$lib/styles/app.css";

  import SiteHeader from "$lib/components/SiteHeader.svelte";
  import { page } from "$app/state";

  let { children } = $props();

  /**
   * Admin runs without the marketing shell.
   *
   * It has its own sticky action bar. The public tracking pages get the
   * site header so they read as part of the same company. No footer:
   * the marketing site carries the company footer, and contact lives on
   * the result itself ("Need help?" and the delayed message).
   */
  const isAdmin = $derived(page.url.pathname.startsWith("/admin"));
</script>

{#if isAdmin}
  {@render children()}
{:else}
  <div class="shell">
    <SiteHeader />
    <main>{@render children()}</main>
  </div>
{/if}

<style>
  /* The page fills the viewport, so the canvas colour reaches the
     bottom edge on the short lookup screen. */
  .shell { display: flex; flex-direction: column; min-height: 100dvh; }
  main { flex: 1; }
</style>
