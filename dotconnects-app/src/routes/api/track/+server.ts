import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { searchShipments } from "$lib/server/shipment-service";
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from "$lib/server/rate-limit";
import { signTrackCode, verifyTrackCode } from "$lib/server/track-link";

/**
 * Public tracking lookup.
 *
 * H1 (carried from the Next build): the phone number is REQUIRED and
 * validated here, not in the browser. The 10-digit check in the form is a
 * UX affordance; this route is the security boundary. Without it,
 * GET /api/track?q=<id> with no phone returned the full customer record —
 * name, mobile, city, items, declared value — to anyone who guessed a
 * sequential tracking ID.
 */
export const GET: RequestHandler = async ({ url, getClientAddress }) => {
  /* A signed link (/t/<code>) replaces the phone check: the signature
     proves Order Central sent this link to the parcel's customer. See
     $lib/server/track-link. */
  const t = (url.searchParams.get("t") ?? "").trim();
  if (t) return byLink(t, getClientAddress());

  const q = (url.searchParams.get("q") ?? "").trim();
  const phone = (url.searchParams.get("phone") ?? "").trim();

  if (!q) {
    return json({ shipments: [], source: "demo", query: q });
  }

  if (!/^\d{10}$/.test(phone)) {
    return json(
      { error: "A 10-digit registered phone number is required." },
      { status: 400 },
    );
  }

  // Rate limit keyed on the tracking ID, not the IP: tracking IDs are
  // guessable and the attack is enumeration, so the thing worth limiting
  // is repeated failures against IDs — not one customer refreshing.
  const limitKey = `${getClientAddress()}:${q.toLowerCase()}`;
  const limit = checkRateLimit(limitKey);
  if (limit.limited) {
    return json(
      { error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const result = await searchShipments(q, { allowNameSearch: false, phone });

  if (result.shipments.length === 0) {
    recordFailedAttempt(limitKey);
  } else {
    clearRateLimit(limitKey);
  }

  return json({ ...result, query: q });
};

const NOT_VALID =
  "This tracking link isn't valid. Enter your order number and the phone number on the order instead.";

async function byLink(code: string, ip: string): Promise<Response> {
  // Failures are what an attacker generates, so they are what's limited.
  const limitKey = `${ip}:link`;
  const limit = checkRateLimit(limitKey);
  if (limit.limited) {
    return json(
      { error: "Too many attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const id = verifyTrackCode(code);
  if (!id) {
    recordFailedAttempt(limitKey);
    return json({ error: NOT_VALID }, { status: 400 });
  }

  const result = await searchShipments(id, { allowNameSearch: false });
  /* Exact tracking id only. The search also matches order numbers and
     order-number prefixes; a link is for one parcel. */
  const mine = result.shipments.filter((s) => String(s.id ?? "").toUpperCase() === id);
  if (mine.length === 0) {
    recordFailedAttempt(limitKey);
    return json({ error: NOT_VALID }, { status: 404 });
  }
  clearRateLimit(limitKey);

  /* A link can be forwarded, so the card opened from one never carries
     the customer's phone number (JD, 22 Sept: option A). The replacement
     parcel gets its own signed code instead of the phone-filled link. */
  const shipments = mine.map(({ customerMobile: _drop, ...s }) => ({
    ...s,
    ...(s.replacedByTrackingId ? { replacedByCode: signTrackCode(s.replacedByTrackingId) } : {}),
  }));
  return json(
    { shipments, source: result.source, via: "link" },
    { headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } },
  );
}
