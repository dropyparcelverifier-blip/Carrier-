import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Receiver for Shiprocket's shipment-status webhook (Settings -> API ->
 * Webhook in the Shiprocket merchant dashboard, where you paste this
 * route's URL + a shared secret).
 *
 * DELIBERATELY GENERIC for now: Shiprocket confirms the webhook MECHANISM
 * (a dashboard-configured URL + shared secret) but their exact JSON payload
 * field names and how the secret is actually transmitted (a header? a
 * query param? HMAC-signed?) are not publicly documented anywhere
 * confirmable — see lib/last-mile.ts's own note on the same research. This
 * endpoint therefore does NOT guess field names or auto-advance any order's
 * stage yet. It verifies the one thing that's confirmed (a shared secret,
 * checked against every plausible transmission method Shiprocket's own
 * docs folder structure implies), accepts any JSON body, and logs it
 * verbatim to captured_shiprocket_webhooks.
 *
 * TO ACTIVATE FOR REAL: once you've registered this URL in your Shiprocket
 * dashboard and triggered their "Test Webhook" button, read back a real
 * captured row (`select * from captured_shiprocket_webhooks order by
 * received_at desc limit 1`) to see the actual field names and how the
 * secret arrived, then update this route to (1) verify the secret the way
 * Shiprocket really sends it, and (2) parse the real fields and call
 * markOrderException/markOrderHandedToCourier accordingly instead of just
 * logging.
 */

const SECRET_ENV = "SHIPROCKET_WEBHOOK_SECRET";

function secretMatches(request: Request, body: unknown): boolean {
  const expected = process.env[SECRET_ENV];
  if (!expected) return false;

  // Checked across every plausible transmission method until a real
  // captured payload confirms which one Shiprocket actually uses — a
  // custom header, a bearer-style Authorization header, a query param, or
  // (least likely but seen in some no-code webhook setups) a field inside
  // the JSON body itself.
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
    console.error("Uncaught POST /api/webhooks/shiprocket error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
