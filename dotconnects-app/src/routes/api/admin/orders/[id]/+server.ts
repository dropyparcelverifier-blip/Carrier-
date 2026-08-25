import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaff, requireAdmin } from "$lib/server/guards";
import { logAudit } from "$lib/server/audit";

/** Event history for one order. */
export const GET: RequestHandler = async ({ cookies, params }) => {
  const guard = await requireStaff(cookies);
  if (!guard.ok) return guard.response;

  const { data, error } = await guard.supabase
    .from("dropy_order_events")
    .select("*")
    .eq("order_id", params.id)
    .order("sort_order", { ascending: true });

  if (error) return json({ error: error.message }, { status: 500 });
  return json({ events: data ?? [] });
};

/**
 * SOFT delete — admin only.
 *
 * The row and its whole event trail survive; every read path filters
 * deleted_at is null. A hard delete with no undo is the wrong default
 * once more than one person has the button.
 */
export const DELETE: RequestHandler = async ({ cookies, params }) => {
  const guard = await requireAdmin(cookies);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  // Read first so the audit row records WHAT was deleted. Without this
  // the log says "someone deleted something" and nothing more.
  const { data: existing } = await supabase
    .from("dropy_orders")
    .select("tracking_id, customer_name, deleted_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) return json({ error: "Order not found" }, { status: 404 });
  if (existing.deleted_at) return json({ error: "Order is already deleted" }, { status: 409 });

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("dropy_orders")
    .update({ deleted_at: now, deleted_by: identity.id })
    .eq("id", params.id);

  if (error) return json({ error: error.message }, { status: 500 });

  await logAudit(identity, {
    action: "order.delete",
    orderId: params.id,
    before: { deleted_at: null },
    after: { deleted_at: now },
    note: `Deleted ${existing.tracking_id} (${existing.customer_name})`,
  });

  return json({ ok: true, softDeleted: true });
};
