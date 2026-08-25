import { NextResponse } from "next/server";
import { requireAdminIdentity } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";
import { insertNewOrder, validateNewOrder, type NewOrderInput } from "@/lib/create-order";
import { genTrackingId, extractPrefix } from "@/lib/tracking-id";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type Body = {
  note?: string;
  /** Optional replacement, created in the same call (the Gate 5 flow). */
  replacement?: {
    us_order_id?: string;
    shipping_days?: number;
  };
};

/**
 * Mark an order damaged in transit, optionally creating its replacement —
 * architecture §4 and the Gate 5 redispatch decision.
 *
 * The damaged order is NOT deleted or hidden. Its full history stays
 * visible and a link forward to the replacement is added, so a customer
 * who has been checking that page for nine days sees what happened and
 * where their parcel is now, rather than hitting a dead end.
 *
 * The replacement is an ordinary new order with its own tracking ID and
 * its own fresh clock. It INHERITS the parent's tracking-ID prefix
 * (RMT/USL) so the customer never sees two unexplained styles for one
 * purchase.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const identity = await requireAdminIdentity();
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { id } = await params;
    const body = (await request.json()) as Body;

    const { data: order } = await supabase
      .from("dropy_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.deleted_at) {
      return NextResponse.json({ error: "Order is deleted" }, { status: 409 });
    }
    if (order.current_stage === "damaged") {
      return NextResponse.json({ error: "Order is already marked damaged." }, { status: 409 });
    }

    // 1. Hold the damaged order where it is. "damaged" is a hold state
    //    outside the 0-100% timeline (architecture §5.2), like exception —
    //    it does not advance, and the clock stops mattering.
    const { error: markErr } = await supabase
      .from("dropy_orders")
      .update({ current_stage: "damaged", status: "Damaged in transit" })
      .eq("id", id);

    if (markErr) {
      console.error("Mark damaged failed:", markErr);
      return NextResponse.json({ error: markErr.message }, { status: 500 });
    }

    await logAudit(identity, {
      action: "order.mark_damaged",
      orderId: id,
      before: { current_stage: order.current_stage },
      after: { current_stage: "damaged" },
      note: body.note?.trim() || `${order.tracking_id} damaged in transit`,
    });

    // 2. No replacement requested — stop here. Marking damaged and
    //    re-dispatching are separate decisions and the second may come
    //    hours later.
    if (!body.replacement?.us_order_id) {
      return NextResponse.json({ ok: true, damaged: true, replacement: null });
    }

    // 3. Create the replacement. Same customer, same items, new US order
    //    ID, fresh shipping window.
    const parentPrefix = extractPrefix(order.tracking_id);
    const usId = body.replacement.us_order_id.trim();

    // dropy_order_id is UNIQUE, so the replacement cannot reuse it. The
    // -R suffix keeps the customer's existing prefix search working: the
    // lookup already matches `dropy_order_id like '<base>-%'`, so
    // searching the original number returns BOTH rows with no new code.
    const baseDropyId = String(order.dropy_order_id).replace(/-R\d+$/, "");
    const { data: siblings } = await supabase
      .from("dropy_orders")
      .select("dropy_order_id")
      .like("dropy_order_id", `${baseDropyId}-R%`);
    const replacementDropyId = `${baseDropyId}-R${(siblings?.length ?? 0) + 1}`;

    const input: NewOrderInput = {
      us_order_id: usId,
      dropy_order_id: replacementDropyId,
      tracking_id: genTrackingId(usId, parentPrefix),
      customer_name: order.customer_name,
      customer_mobile: order.customer_mobile,
      customer_email: order.customer_email ?? null,
      customer_address: order.customer_address ?? null,
      customer_city: order.customer_city,
      customer_pincode: order.customer_pincode ?? null,
      shipping_days: body.replacement.shipping_days ?? order.shipping_days,
      shipping_mode: order.shipping_mode,
      order_date: null, // fresh clock — the replacement starts today
      carrier_name: null,
      awb_number: null,
      admin_notes: `Replacement for ${order.tracking_id} (damaged in transit)`,
      payment_status: order.payment_status,
      items: typeof order.items === "string" ? JSON.parse(order.items) : (order.items ?? []),
    };

    const validationErr = validateNewOrder(input);
    if (validationErr) {
      // The damaged mark already succeeded and is correct — report the
      // replacement failure without pretending the whole call failed.
      return NextResponse.json(
        { ok: true, damaged: true, replacement: null, replacementError: validationErr },
        { status: 207 },
      );
    }

    const result = await insertNewOrder(input);
    if (result.error !== undefined) {
      return NextResponse.json(
        { ok: true, damaged: true, replacement: null, replacementError: result.error },
        { status: 207 },
      );
    }

    // 4. Link them. replacement_of lives on the NEW row pointing back at
    //    the damaged one, so following the chain forwards is a single
    //    lookup from either end.
    await supabase
      .from("dropy_orders")
      .update({ replacement_of: id })
      .eq("id", result.order.id);

    await logAudit(identity, {
      action: "order.create",
      orderId: result.order.id,
      after: {
        tracking_id: result.order.tracking_id,
        us_order_id: usId,
        replacement_of: order.tracking_id,
      },
      note: `Redispatch of ${order.tracking_id} → ${result.order.tracking_id}`,
    });

    return NextResponse.json({
      ok: true,
      damaged: true,
      replacement: {
        id: result.order.id,
        tracking_id: result.order.tracking_id,
        dropy_order_id: replacementDropyId,
      },
    });
  } catch (err: any) {
    console.error("Uncaught POST /api/admin/orders/[id]/damaged error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
