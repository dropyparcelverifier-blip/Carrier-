import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Receiver for Shiprocket's shipment-status webhook (Settings -> API ->
 * Webhook in the Shiprocket merchant dashboard, where you paste this
 * route's URL + a shared secret).
 *
 * Path is deliberately generic ("courier-updates-a", not "shiprocket") —
 * Shiprocket's own webhook form rejects any URL containing "shiprocket",
 * "kartrocket", "sr", or "kr" (their own dashboard note), so a URL that
 * says what it's for by name isn't an option here the way it normally
 * would be. Renamed from app/api/webhooks/shiprocket for this reason.
 *
 * Confirmed via Shiprocket's own dashboard (not just external research):
 * Auth Token Type dropdown offers "x-api-key" as the default/shown option,
 * so that header IS the real transmission method — secretMatches() below
 * checks it first. The exact JSON payload field names are still
 * unconfirmed (a "Download Sample Payload" link exists on their webhook
 * screen — worth checking before assuming). This endpoint does NOT parse
 * fields or auto-advance any order's stage yet — it verifies the secret,
 * accepts any JSON body, and logs it verbatim to
 * captured_shiprocket_webhooks so real field names can be read back after
 * a live test fires.
 *
 * TO ACTIVATE FOR REAL: read back a captured row (`select * from
 * captured_shiprocket_webhooks order by received_at desc limit 1`) after
 * triggering a real webhook, then update this route to parse the real
 * fields and call markOrderException/markOrderHandedToCourier accordingly
 * instead of just logging.
 */

const SECRET_ENV = "SHIPROCKET_WEBHOOK_SECRET";

function secretMatches(request: Request, body: unknown): boolean {
  const expected = process.env[SECRET_ENV];
  if (!expected) return false;

  // x-api-key confirmed via Shiprocket's own dashboard (Auth Token Type
  // dropdown) — checked first since it's no longer a guess. The rest stay
  // as fallbacks in case a different Auth Token Type gets selected later.
  const headerSecret = request.headers.get("x-api-key") ?? request.headers.get("x-webhook-secret");
  if (headerSecret === expected) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${expected}` || authHeader === expected) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === expected || url.searchParams.get("token") === expected) return true;

  if (body && typeof body === "object" && "secret" in (body as Record<string, unknown>)) {
    if ((body as Record<string, unknown>).secret === expected) return true;
  }

  return false;
}

export async function POST(request: Request) {
  try {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      // Some webhook senders post form-encoded or empty test pings —
      // still worth capturing rather than rejecting outright at this
      // exploratory stage.
      body = { _unparsed_body: await request.text().catch(() => null) };
    }

    if (!secretMatches(request, body)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const headersRecord: Record<string, string> = {};
    request.headers.forEach((value, key) => { headersRecord[key] = value; });

    const { error } = await supabase.from("captured_shiprocket_webhooks").insert({
      payload: body,
      headers: headersRecord,
    });

    if (error) {
      console.error("Failed to log Shiprocket webhook:", error);
      // Still 200 — Shiprocket will retry/disable the webhook on repeated
      // non-2xx responses, and a logging failure on our side shouldn't
      // cause them to give up on a real delivery-status update.
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Uncaught POST /api/webhooks/courier-updates-a error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
