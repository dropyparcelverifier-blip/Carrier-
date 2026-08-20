import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Receiver for Velocity Shipping's shipment-status webhook.
 *
 * Velocity has NO public developer documentation at all — no docs
 * subdomain, no Postman workspace, no webhook payload reference found
 * anywhere confirmable. Per their own onboarding process (per third-party
 * integration guides), a webhook is "shared by the Onboarding team"
 * per-merchant on request — contact Velocity support/your account manager
 * to actually get a webhook URL field and secret, since there's no
 * self-serve dashboard setting for it the way Shiprocket has.
 *
 * Same "capture first, don't guess field names" approach as
 * app/api/webhooks/shiprocket/route.ts — see that file's own note for the
 * full reasoning. Once Velocity's onboarding team confirms the real secret
 * transmission method and payload shape, update secretMatches() and add
 * real field parsing here instead of just logging.
 */

const SECRET_ENV = "VELOCITY_WEBHOOK_SECRET";

function secretMatches(request: Request, body: unknown): boolean {
  const expected = process.env[SECRET_ENV];
  if (!expected) return false;

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
    console.error("Uncaught POST /api/webhooks/velocity error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
