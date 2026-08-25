import { NextResponse } from "next/server";
import { requireAdminIdentity } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Undo a soft delete. Admin only.
 *
 * Soft delete exists so a misclick isn't permanent — this is the other
 * half of that. Without it the "recoverable" in "recoverable delete" is
 * only true for someone with SQL access.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const identity = await requireAdminIdentity();
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (identity.role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { id } = await params;

    const { data: existing } = await supabase
      .from("dropy_orders")
      .select("tracking_id, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!existing.deleted_at) {
      return NextResponse.json({ error: "Order is not deleted" }, { status: 409 });
    }

    const { error } = await supabase
      .from("dropy_orders")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", id);

    if (error) {
      console.error("Supabase restore error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAudit(identity, {
      action: "order.restore",
      orderId: id,
      note: `Restored ${existing.tracking_id}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Uncaught POST /api/admin/orders/[id]/restore error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
