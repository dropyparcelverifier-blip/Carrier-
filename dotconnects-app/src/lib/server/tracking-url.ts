/**
 * Validates the Indian courier link a brand admin pastes. The customer's
 * /c/ link redirects to it from our domain, so only https is accepted.
 */

/** Couriers' own tracking pages. Anything else is accepted with a warning. */
const KNOWN_HOSTS = /(^|\.)(velocityshipping\.in|velocity\.in|shiprocket\.co|shiprocket\.in)$/i;

export function checkTrackingUrl(raw: string): { url: string | null; error?: string; warning?: string } {
  const s = String(raw ?? "").trim();
  if (!s) return { url: null, error: "Paste the Indian tracking link." };
  let u: URL;
  try { u = new URL(s); } catch { return { url: null, error: "That isn't a valid link." }; }
  /* The customer is redirected to this from our domain, so only a real
     https page is allowed — never javascript:, data: or plain http. */
  if (u.protocol !== "https:") return { url: null, error: "The link must start with https://" };
  if (u.username || u.password) return { url: null, error: "That isn't a valid link." };
  if (s.length > 500) return { url: null, error: "That link is too long." };
  return KNOWN_HOSTS.test(u.hostname)
    ? { url: u.toString() }
    : { url: u.toString(), warning: `Saved, but ${u.hostname} isn't a Velocity or Shiprocket page — open the customer link once to check it.` };
}
