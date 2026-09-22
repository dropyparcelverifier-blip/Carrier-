<script lang="ts">
  import { COMPANY, SITE_URL } from "$lib/company";
  import EmailText from "./EmailText.svelte";

  /**
   * Footer shared with the marketing site — same content as before, laid
   * out and styled like the carrier's footer (carrier/components/Footer.tsx)
   * so the two apps read as one company: surface-2 panel, the contact
   * block where the carrier has its brand column, a headed link column
   * where the carrier's PRODUCT column sits, and the rounded inset bar
   * with © and the legal links.
   *
   * The raised/pressed shadows are the carrier's .neuro-* values copied
   * verbatim (light and dark), scoped to this component — the tracking
   * page above stays flat paper.
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
    <div class="grid">
      <div class="reach">
        <p class="head">Questions about a consignment?</p>
        <!-- Email only: no phone line, no WhatsApp, no office line. -->
        <div class="contact">
          <span class="tile" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
          </span>
          <a class="mail" href="mailto:{COMPANY.email}"><EmailText /></a>
        </div>
      </div>

      <nav class="explore" aria-label="DotConnects Logistics">
        <p class="colh">Explore</p>
        <ul>
          {#each LINKS as l}<li><a href={l.href}>{l.label}</a></li>{/each}
        </ul>
      </nav>
    </div>

    <div class="bar">
      <span>© {year} {COMPANY.legalName}</span>
      <ul class="legal">
        {#each LEGAL as l}<li><a href={l.href}>{l.label}</a></li>{/each}
      </ul>
    </div>
  </div>
</footer>

<style>
  footer {
    margin-top: 40px;
    border-top: 1px solid var(--color-hairline);
    background: var(--color-surface-2);
    /* Carrier's light-theme .neuro-* strengths; dark overrides below. */
    --lift: 95%;  --sink: 12%;  --in-lift: 95%;  --in-sink: 13%;
    --sm-lift: 90%; --sm-sink: 11%;
  }
  :global(html[data-theme="dark"]) footer {
    --lift: 14%;  --sink: 20%;  --in-lift: 14%;  --in-sink: 22%;
    --sm-lift: 12%; --sm-sink: 20%;
  }
  ul { list-style: none; margin: 0; padding: 0; }
  a { color: inherit; }
  a:hover { color: var(--color-ink); text-decoration: none; }

  /* ── Phone first (carrier's mobile footer) ── */
  .inner { max-width: 1280px; margin: 0 auto; padding: 40px 20px 48px; }
  .head { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-ink); }

  /* Contact: one raised white card, icon in a pressed tile. */
  .contact {
    display: flex; align-items: center; gap: 12px;
    margin-top: 20px; padding: 16px; border-radius: 12px;
    background: var(--color-surface-1);
    box-shadow:
      -8px -8px 18px color-mix(in srgb, var(--color-surface-1) 100%, white var(--lift)),
      8px 8px 18px color-mix(in srgb, var(--color-surface-1) 100%, black var(--sink));
    font-size: 14px; color: var(--color-ink-subtle);
  }
  .tile {
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    width: 32px; height: 32px; border-radius: 8px;
    color: var(--color-primary);
    background: var(--color-surface-1);
    box-shadow:
      inset -3px -3px 7px color-mix(in srgb, var(--color-surface-1) 100%, white var(--sm-lift)),
      inset 3px 3px 7px color-mix(in srgb, var(--color-surface-1) 100%, black var(--sm-sink));
  }
  .tile svg { width: 14px; height: 14px; }
  .mail { min-width: 0; overflow-wrap: break-word; }

  /* No bottom nav on DOT (the carrier has one), so the links stay on phones. */
  .colh { display: none; }
  .explore ul {
    display: flex; flex-wrap: wrap; gap: 10px 20px;
    margin-top: 20px; padding: 0 4px;
    font-size: 14px; color: var(--color-ink-subtle);
  }

  /* © and legal: rounded inset bar, legal under a hairline. */
  .bar {
    margin-top: 24px; padding: 16px; border-radius: 12px;
    font-size: 12px; color: var(--color-ink-tertiary);
    background: var(--color-surface-1);
    box-shadow:
      inset -6px -6px 14px color-mix(in srgb, var(--color-surface-1) 100%, white var(--in-lift)),
      inset 6px 6px 14px color-mix(in srgb, var(--color-surface-1) 100%, black var(--in-sink));
  }
  .legal {
    display: flex; flex-wrap: wrap; gap: 10px 16px;
    margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-hairline);
  }
  .legal a { color: var(--color-ink-tertiary); }
  .legal a:hover { color: var(--color-ink); }

  /* ── Desktop (carrier's desktop footer) ── */
  @media (min-width: 720px) {
    .inner { padding: 80px 32px; }
    /* Contact column 298px (the carrier's brand column at xl), then the
       link column — so Explore lines up with the carrier's PRODUCT. */
    .grid { display: grid; grid-template-columns: minmax(298px, max-content) 1fr; column-gap: 32px; }

    .contact {
      margin-top: 20px; padding: 0; border-radius: 0;
      background: none; box-shadow: none; gap: 10px;
    }
    .tile {
      width: 28px; height: 28px;
      color: var(--color-ink-tertiary);
      box-shadow:
        -8px -8px 18px color-mix(in srgb, var(--color-surface-1) 100%, white var(--lift)),
        8px 8px 18px color-mix(in srgb, var(--color-surface-1) 100%, black var(--sink));
    }
    .mail { white-space: nowrap; }

    .colh {
      display: block; margin: 0 0 16px;
      font-size: 12px; font-weight: 600; letter-spacing: 0.025em;
      text-transform: uppercase; color: var(--color-ink);
    }
    .explore ul { flex-direction: column; gap: 12px; margin-top: 0; padding: 0; }

    .bar {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 16px; margin-top: 56px; padding: 16px 20px;
    }
    .legal { gap: 8px 20px; margin-top: 0; padding-top: 0; border-top: 0; }
  }
</style>
