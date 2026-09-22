import { COMPANY } from "@/lib/company";

/**
 * The support address as text, safe to wrap.
 *
 * "contact-us@…" has a hyphen, and a hyphen is a line-break point: the
 * desktop footer showed "contact-" / "us@dotconnects…" at 1280px and up,
 * which reads as a hyphenated "contactus@". Everything up to the "@" is
 * held together; the one place it may break is straight after it. <wbr>
 * adds no character, so a copied address stays exact.
 *
 * Goes INSIDE the <a>, so the link keeps its own classes. One outer
 * <span>, so a flex parent's gap can never open between the halves. Put
 * whitespace-nowrap on the link where the address must stay on one line.
 */
export default function EmailText() {
  const at = COMPANY.email.indexOf("@");
  return (
    <span>
      <span className="whitespace-nowrap">{COMPANY.email.slice(0, at + 1)}</span>
      <wbr />
      {COMPANY.email.slice(at + 1)}
    </span>
  );
}
