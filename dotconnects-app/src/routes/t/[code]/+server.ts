import type { RequestHandler } from "./$types";

/**
 * /t/<code> — the link in a customer's WhatsApp or email.
 *
 * Hands the code to the tracking page, which asks /api/track to check it
 * and opens the card. Checking happens in exactly one place (the API), so
 * a bad or edited code gets the same "link not valid" message and the
 * lookup form, never a blank page.
 */
export const GET: RequestHandler = ({ params }) =>
  new Response(null, {
    status: 303,
    headers: {
      location: `/?t=${encodeURIComponent(params.code)}`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
