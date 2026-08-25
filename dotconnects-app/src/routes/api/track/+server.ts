import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { searchShipments } from "$lib/server/shipment-service";
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from "$lib/server/rate-limit";

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
