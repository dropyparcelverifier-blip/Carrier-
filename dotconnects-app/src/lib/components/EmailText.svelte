<script lang="ts">
  import { COMPANY } from "$lib/company";

  /**
   * The support address as text, safe to wrap.
   *
   * "contact-us@…" has a hyphen, and a hyphen is a line-break point. On a
   * 320–340px phone the help card showed "contact-" / "us@dotconnects…",
   * and the delayed message split that way on every phone — which reads
   * as a hyphenated "contactus@". Everything up to the "@" is held
   * together; the one place it may break is straight after it. <wbr> adds
   * no character, so a copied or long-pressed address stays exact.
   *
   * Goes INSIDE the <a>, so the link keeps the parent's own styles. One
   * outer <span>, so a flex parent's gap can never open between the halves.
   */
  const at = COMPANY.email.indexOf("@");
  const local = COMPANY.email.slice(0, at + 1);
  const domain = COMPANY.email.slice(at + 1);
</script>

<span><span class="local">{local}</span><wbr />{domain}</span>

<style>
  .local { white-space: nowrap; }
</style>
