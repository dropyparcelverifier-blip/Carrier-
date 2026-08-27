<script lang="ts">
  import { COMPANY, SITE_URL } from "$lib/company";

  /**
   * Header shared with the marketing site.
   *
   * Every link here is CROSS-ORIGIN — this app is track.<domain>, the
   * marketing site is <domain>. Plain <a>, not client-side routing.
   *
   * The nav is deliberately short. Someone on this page arrived from a
   * WhatsApp link to find one parcel; a full marketing nav would be
   * noise. What they need is proof this is a real company, and a way
   * back if they want it.
   */
  let { compact = false } = $props();
</script>

<header class:compact>
  <a class="brand" href={SITE_URL}>
    <span class="mark">DC</span>
    <span class="names">
      <b>DotConnects</b>
      <small>Logistics</small>
    </span>
  </a>

  <nav>
    <a href="{SITE_URL}/#services">Services</a>
    <a href="{SITE_URL}/quote">Get a quote</a>
    <a class="cta" href="{SITE_URL}/contact">Contact</a>
  </nav>
</header>

<style>
  header {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; padding: 14px 20px;
    background: var(--color-surface-1);
    border-bottom: 1px solid var(--color-hairline);
  }

  .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .brand:hover { text-decoration: none; }
  .mark {
    display: grid; place-items: center;
    width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
    background: var(--color-primary); color: #fff;
    font-family: var(--font-display); font-weight: 700; font-size: 12px;
  }
  .names { display: flex; flex-direction: column; line-height: 1.15; }
  .names b {
    font-family: var(--font-display);
    font-size: 15px; font-weight: 600; letter-spacing: -0.01em;
    color: var(--color-ink);
  }
  .names small { font-size: 11px; color: var(--color-ink-tertiary); }

  nav { display: flex; align-items: center; gap: 4px; }
  nav a {
    padding: 8px 10px; border-radius: 8px;
    font-size: 13px; font-weight: 500;
    color: var(--color-ink-subtle);
    transition: color 0.15s ease, background 0.15s ease;
  }
  nav a:hover { color: var(--color-ink); background: var(--color-surface-2); text-decoration: none; }
  nav a.cta {
    border: 1px solid var(--color-hairline-strong);
    color: var(--color-ink);
  }
  nav a.cta:hover { border-color: var(--color-primary); color: var(--color-primary); }

  /* Below 560px only the CTA survives — the other two are one tap away
     via the brand mark, and a cramped three-item nav on a 360px screen
     helps nobody. */
  @media (max-width: 560px) {
    nav a:not(.cta) { display: none; }
  }

  @media (min-width: 900px) {
    header { padding: 16px 32px; }
    nav { gap: 6px; }
    nav a { padding: 9px 14px; font-size: 14px; }
  }
</style>
