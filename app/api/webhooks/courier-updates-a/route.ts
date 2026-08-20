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
 * REAL payload shape, confirmed from a captured live test webhook
 * (2026-08-20): { awb, current_status, current_status_id, shipment_status,
 * shipment_status_id, courier_name, scans: [{date, status, activity,
 * location}], order_id, sr_order_id, is_return, channel_id, etd,
 * current_timestamp }. Auth confirmed as the x-api-key header (Shiprocket's
 * own dashboard shows this as the selected/default Auth Token Type).
 *
 * SCOPE: this app's own tracking stops at handed_to_courier (see STAGES's
 * note in lib/types.ts) — what the courier does after Vashi handover is
 * explicitly their responsibility, not something this app models as a
 * customer-facing status change. So this webhook LOGS the courier's real
 * update (appended as a note on the order's handed_to_courier event, so an
 * admin/customer can still see it) but never mutates current_stage,
 * status, or progress — no markOrderException call here, even for a
 * problem status. Shiprocket's numeric status IDs aren't fully documented
 * (only 7="Delivered" and 18="IN TRANSIT" are confirmed) and aren't stable
 * across their own history per community reports, so this matches on the
 * `current_status` STRING with a small known-benign allowlist and treats
 * everything else as worth a human's attention — logged with a flag, not
 * silently dropped, but still not auto-actioned.
 *
 * Matched by AWB (last_mile_awb on the order row) — Shiprocket has no
 * knowledge of our internal order id, only the AWB an admin entered when
 * marking the order handed off.
 */

const SECRET_ENV = "SHIPROCKET_WEBHOOK_SECRET";

// Statuses that are just normal progress on a leg this app doesn't drive —
// nothing here should ever need a human to look at it. Matched
// case-insensitively against Shiprocket's `current_status` string, not the
// numeric id (see the note above on why the ids aren't trustworthy).
const BENIGN_STATUSES = [
  "manifested", "pickup", "picked up", "in transit", "out for delivery", "delivered",
];

function isBenignStatus(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return BENIGN_STATUSES.some((b) => s.includes(b));
}

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

    const { error: captureErr } = await supabase.from("captured_shiprocket_webhooks").insert({
      payload: body,
      headers: headersRecord,
    });
    if (captureErr) {
      console.error("Failed to log Shiprocket webhook:", captureErr);
      // Not fatal — still try to attach it to the order below.
    }

    const awb = (body as Record<string, unknown> | null)?.awb;
    if (typeof awb === "string" && awb.trim()) {
      const status = (body as Record<string, unknown>).current_status ?? (body as Record<string, unknown>).shipment_status;
      const { data: order } = await supabase
        .from("dropy_orders")
        .select("id")
        .eq("last_mile_awb", awb.trim())
        .eq("last_mile_courier", "Shiprocket")
        .maybeSingle();

      if (order) {
        const { data: event } = await supabase
          .from("dropy_order_events")
          .select("id, note")
          .eq("order_id", order.id)
          .eq("stage", "handed_to_courier")
          .maybeSingle();

        if (event) {
          const statusText = typeof status === "string" ? status : "Status update";
          const flag = isBenignStatus(statusText) ? "" : " — needs review";
          const ts = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " IST";
          const appended = `${event.note ? event.note + " | " : ""}[${ts}] Shiprocket: ${statusText}${flag}`;
          await supabase.from("dropy_order_events").update({ note: appended }).eq("id", event.id);
        }
      }
      // No matching order/event is not an error — plenty of real Shiprocket
      // test/demo webhooks (like the one that confirmed this payload shape)
      // won't match any real AWB on file.
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Uncaught POST /api/webhooks/courier-updates-a error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
