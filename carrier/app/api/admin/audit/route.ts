import { NextResponse } from "next/server";
import { requireAdminIdentity } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Read the audit log. Admin only.
 *
 * Filters:
 *   ?order_id=<uuid>   rows for one order
 *   ?actor=<name>      rows by one actor — works for humans and for
 *                      system actors ("Order Central (DOC)", webhooks)
 *   ?action=<action>   e.g. order.delete
 *   ?limit=<n>         default 50, max 200
 *
 * Admin-only because the log names who did what. Exposing it to staff
 * turns an accountability record into a surveillance feed of colleagues.
 */
export async function GET(request: Request) {
  try {
    const identity = await requireAdminIdentity();
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (identity.role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const url = new URL(request.url);
    const orderId = url.searchParams.get("order_id");
    const actor = url.searchParams.get("actor");
    const action = url.searchParams.get("action");
    const limitRaw = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, MAX_LIMIT)
      : DEFAULT_LIMIT;

    let query = supabase
      .from("admin_audit_log")
      .select("id, actor_type, actor_name, action, order_id, before, after, note, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (orderId) query = query.eq("order_id", orderId);
    if (actor) query = query.eq("actor_name", actor);
    if (action) query = query.eq("action", action);

    const { data, error } = await query;
    if (error) {
      console.error("Supabase audit read error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entries: data ?? [] });
  } catch (err: any) {
    console.error("Uncaught GET /api/admin/audit error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
