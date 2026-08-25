import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAdmin } from "$lib/server/guards";
import { logAudit } from "$lib/server/audit";

/**
 * Undo a soft delete. Admin only.
 *
 * The other half of recoverable delete — without this, "recoverable" is
 * only true for someone with SQL access.
 */
export const POST: RequestHandler = async ({ cookies, params }) => {
  const guard = await requireAdmin(cookies);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  const { data: existing } = await supabase
    .from("dropy_orders")
    .select("tracking_id, deleted_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!existing) return json({ error: "Order not found" }, { status: 404 });
  if (!existing.deleted_at) return json({ error: "Order is not deleted" }, { status: 409 });

  const { error } = await supabase
    .from("dropy_orders")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", params.id);

  if (error) return json({ error: error.message }, { status: 500 });

  await logAudit(identity, {
    action: "order.restore",
    orderId: params.id,
    note: `Restored ${existing.tracking_id}`,
  });

  return json({ ok: true });
};
