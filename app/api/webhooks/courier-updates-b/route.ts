import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Receiver for Velocity Shipping's shipment-status webhook.
 *
 * Renamed to match app/api/webhooks/courier-updates-a's naming (Shiprocket
 * rejects any webhook URL containing "shiprocket"/"kartrocket"/"sr"/"kr" —
 * no equivalent restriction confirmed for Velocity, but matching names
 * keeps both endpoints consistent and avoids the same surprise if Velocity
 * turns out to have a similar rule).
 *
 * Velocity's own dashboard (Settings -> Webhooks) DOES have a self-serve
 * webhook screen — earlier research claiming "no public dashboard, contact
 * onboarding team" turned out to be wrong/outdated; a live screenshot of
 * the real screen is the authority here, not that research. Confirmed via
 * that real screen: "Auth Token Type" offers "API Key", transmitted in an
 * HTTP header (exact header name shown as a selectable dropdown, not
 * fixed — check which one is actually selected before assuming). Event
 * Subscription offers three distinct real event types: Status Change,
 * Tracking Addition, QC Update — worth knowing when parsing the real
 * payload later, since the shape may differ per event type.
 *
 * Still capturing generically, not parsing fields yet, since the exact
 * JSON payload shape per event type isn't confirmed until a real webhook
 * fires. Read back a captured row (`select * from
 * captured_velocity_webhooks order by received_at desc limit 1`) after a
 * real event, then update secretMatches() to check the confirmed header
 * specifically and add real field parsing.
 */

const SECRET_ENV = "VELOCITY_WEBHOOK_SECRET";

function secretMatches(request: Request, body: unknown): boolean {
  const expected = process.env[SECRET_ENV];
  if (!expected) return false;

  // x-api-key is the most common header name for an "API Key" auth type
  // (and what Shiprocket's equivalent dropdown defaults to) — checked
  // first as the likely match, with x-webhook-secret and the rest as
  // fallbacks until a real captured request confirms which one Velocity's
  // dashboard actually sends.
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
      body = { _unparsed_body: await request.text().catch(() => null) };
    }

    if (!secretMatches(request, body)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const headersRecord: Record<string, string> = {};
    request.headers.forEach((value, key) => { headersRecord[key] = value; });

    const { error } = await supabase.from("captured_velocity_webhooks").insert({
      payload: body,
      headers: headersRecord,
    });

    if (error) {
      console.error("Failed to log Velocity webhook:", error);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Uncaught POST /api/webhooks/courier-updates-b error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
