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
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import { page } from "$app/state";

  let { children } = $props();

  /**
   * Admin runs without the marketing shell.
   *
   * It has its own sticky action bar, and a footer full of "Get a quote"
   * links is noise for someone working through an orders table. The
   * public tracking pages get the full shell so they read as part of the
   * same company rather than a detached tool.
   */
  const isAdmin = $derived(page.url.pathname.startsWith("/admin"));
</script>

{#if isAdmin}
  {@render children()}
{:else}
  <div class="shell">
    <SiteHeader />
    <main>{@render children()}</main>
    <SiteFooter />
  </div>
{/if}

<style>
  /* Footer pinned to the bottom on short pages — the lookup screen is
     mostly empty and a footer floating mid-viewport looks broken. */
  .shell { display: flex; flex-direction: column; min-height: 100dvh; }
  main { flex: 1; }
</style>
