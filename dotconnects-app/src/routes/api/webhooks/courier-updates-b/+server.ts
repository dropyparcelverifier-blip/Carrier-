import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSupabaseAdmin } from "$lib/server/supabase-admin";
import { env } from "$env/dynamic/private";

/**
 * Velocity webhook — CAPTURE ONLY, deliberately.
 *
 * Velocity's API is documented (shazam.velocity.in) and their webhook
 * config lives at Settings → Webhooks, but no real payload has been
 * captured from this store yet. Writing a parser against a guessed shape
 * would produce something that looks finished and silently does nothing.
 *
 * So: store everything, parse nothing, and let the manual milestone
 * override in the admin panel cover Velocity orders until one real event
 * arrives.
 *
 * To unblock: point Velocity at this URL, fire a test event, then
 *   select payload, headers from captured_velocity_webhooks
 *   order by received_at desc limit 1;
 * That single row answers which header carries the key, the real field
 * names, and whether the shape differs per event type.
 */
export const POST: RequestHandler = async ({ request }) => {
  const expected = env.VELOCITY_WEBHOOK_SECRET;
  const headers = Object.fromEntries(request.headers);

  // Capture even when auth fails — an unauthenticated hit is exactly the
  // evidence needed to work out which header they actually send.
  const raw = await request.text();
  let payload: any = null;
  try { payload = JSON.parse(raw); } catch { /* keep raw */ }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from("captured_velocity_webhooks").insert({
      payload: payload ?? { raw },
      headers,
    });
  }

  if (expected) {
    const provided =
      request.headers.get("x-api-key") ??
      request.headers.get("x-webhook-secret") ??
      request.headers.get("authorization") ?? "";
    if (!provided.includes(expected)) {
      return json({ ok: true, captured: true, authenticated: false });
    }
  }

  return json({ ok: true, captured: true, authenticated: true });
};
