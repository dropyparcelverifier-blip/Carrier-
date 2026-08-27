<script lang="ts">
  import { COMPANY, SITE_URL } from "$lib/company";

  /**
   * Footer shared with the marketing site.
   *
   * Velocity's tracking page does this and it's the right instinct — a
   * customer looking at a delayed parcel wants to know who to contact
   * and that the company is real. Contact details sit above the links
   * for that reason.
   */
  const year = new Date().getFullYear();

  const LINKS = [
    { href: `${SITE_URL}/#services`, label: "Services" },
    { href: `${SITE_URL}/quote`, label: "Get a quote" },
    { href: `${SITE_URL}/about`, label: "About" },
    { href: `${SITE_URL}/#faq`, label: "FAQ" },
  ];

  const LEGAL = [
    { href: `${SITE_URL}/privacy`, label: "Privacy" },
    { href: `${SITE_URL}/terms`, label: "Terms" },
    { href: `${SITE_URL}/cargo-claims`, label: "Cargo claims" },
  ];
</script>

<footer>
  <div class="inner">
    <div class="reach">
      <p class="head">Questions about a consignment?</p>
      <div class="ways">
        <a href="mailto:{COMPANY.email}">{COMPANY.email}</a>
        <a href={COMPANY.phoneHref}>{COMPANY.phone}</a>
        <a href={COMPANY.whatsappHref} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      </div>
      <p class="where">{COMPANY.locations}</p>
    </div>

    <nav class="links">
      {#each LINKS as l}<a href={l.href}>{l.label}</a>{/each}
    </nav>
  </div>

  <div class="base">
    <span>© {year} {COMPANY.legalName}</span>
    <nav class="legal">
      {#each LEGAL as l}<a href={l.href}>{l.label}</a>{/each}
    </nav>
  </div>
</footer>

<style>
  footer {
    margin-top: 40px;
    border-top: 1px solid var(--color-hairline);
    background: var(--color-surface-1);
  }
  .inner {
    display: flex; flex-direction: column; gap: 24px;
    max-width: 1080px; margin: 0 auto;
    padding: 28px 20px;
  }

  .head { margin: 0 0 10px; font-size: 14px; font-weight: 600; color: var(--color-ink); }
  .ways { display: flex; flex-wrap: wrap; gap: 6px 18px; }
  .ways a { font-size: 14px; font-weight: 500; }
  .where { margin: 10px 0 0; font-size: 12px; color: var(--color-ink-tertiary); }

  .links { display: flex; flex-wrap: wrap; gap: 8px 20px; }
  .links a { font-size: 13px; color: var(--color-ink-subtle); }
  .links a:hover { color: var(--color-ink); text-decoration: none; }

  .base {
    display: flex; flex-wrap: wrap; align-items: center;
    justify-content: space-between; gap: 10px 20px;
    max-width: 1080px; margin: 0 auto;
    padding: 14px 20px 24px;
    border-top: 1px solid var(--color-hairline);
    font-size: 12px; color: var(--color-ink-tertiary);
  }
  .legal { display: flex; flex-wrap: wrap; gap: 6px 16px; }
  .legal a { color: var(--color-ink-tertiary); }
  .legal a:hover { color: var(--color-ink-subtle); text-decoration: none; }

  @media (min-width: 720px) {
    .inner { flex-direction: row; justify-content: space-between; padding: 32px 32px; }
    .links { flex-direction: column; gap: 10px; text-align: right; }
    .base { padding: 14px 32px 28px; }
  }
</style>
