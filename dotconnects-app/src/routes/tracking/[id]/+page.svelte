<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  /**
   * Shareable tracking link — /tracking/TRKMT2MLYRK1058
   *
   * Pre-fills the tracking ID and jumps the cursor to the phone field,
   * so a link sent over WhatsApp is one tap and ten digits.
   *
   * THE PHONE CHECK IS DELIBERATELY KEPT.
   *
   * Auto-loading from the URL alone would be more convenient and would
   * expose every consignment to anyone holding the link — consignee
   * name, destination city, item descriptions and quantities. Tracking
   * IDs are 18 characters and not guessable in bulk, but links get
   * forwarded, pasted into group chats and indexed. The phone number is
   * the one thing that proves the person opening it is the person the
   * parcel belongs to.
   *
   * This is one line to change if you'd rather have the convenience —
   * see the note in the redirect below.
   */
  const id = $derived(page.params.id ?? "");

  /* Carried through the redirect, not dropped.
  
     The form reads ?phone= and pre-fills it. This route rebuilt the URL
     from the id alone, so every param on the way in was discarded — an
     internal link built WITH the phone still landed on an empty phone
     field, and looked exactly like the bug where the phone was never
     appended at all. Only ever set on links built inside DOC; a link a
     customer was sent carries no phone and still meets the check. */
  const phone = $derived(page.url.searchParams.get("phone") ?? "");
  const target = $derived(
    `/?id=${encodeURIComponent(id)}` +
      (/^\d{10}$/.test(phone) ? `&phone=${phone}` : ""),
  );

  onMount(() => {
    // Hand off to the main form with the id pre-filled. Keeping the
    // lookup in one place means one set of error states, one rate
    // limiter, and no second copy of the tracking UI to keep in step.
    if (id) goto(target, { replaceState: true });
  });
</script>

<svelte:head>
  <title>Track {id} · DotConnects</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="wait">
  <p>Opening tracking for <span class="mono">{id}</span>…</p>
  <noscript>
    <p>
      <a href={target}>Continue to tracking</a>
    </p>
  </noscript>
</div>

<style>
  .wait {
    display: grid; place-items: center; gap: 8px;
    min-height: 40vh; padding: 24px;
    text-align: center; color: var(--color-ink-subtle); font-size: 14px;
  }
</style>
