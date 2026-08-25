import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAdmin } from "$lib/server/guards";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Read the audit log. Admin only.
 *
 * Gated because the log names who did what. Exposing it to staff turns an
 * accountability record into a feed of colleagues' activity — a different
 * thing, needing different consent.
 */
export const GET: RequestHandler = async ({ cookies, url }) => {
  const guard = await requireAdmin(cookies);
  if (!guard.ok) return guard.response;

  const raw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, MAX_LIMIT) : DEFAULT_LIMIT;

  let q = guard.supabase
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  const orderId = url.searchParams.get("order_id");
  const actor = url.searchParams.get("actor");
  const action = url.searchParams.get("action");
  if (orderId) q = q.eq("order_id", orderId);
  // Works for humans AND system actors — "Order Central (DOC)",
  // "Shiprocket webhook".
  if (actor) q = q.eq("actor_name", actor);
  if (action) q = q.eq("action", action);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ entries: data ?? [] });
};
