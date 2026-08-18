import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { STAGES } from "@/lib/types";
import { STAGE_PROGRESS, STAGE_LOCATIONS, stageToStatus } from "@/lib/admin-stages";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await params;
  const { data: events, error } = await supabase
    .from("dropy_order_events")
    .select("*")
    .eq("order_id", id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: events ?? [] });
}

type UpdateBody = {
  stage: string; note: string; paymentStatus: string;
  shippingDays: number; adminNotes: string; orderCreatedAt: string;
};

export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await params;
  const body = (await request.json()) as UpdateBody;

  const stageInfo = STAGES.find((s) => s.key === body.stage);
  if (!stageInfo) return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  const stageIdx = STAGES.findIndex((s) => s.key === body.stage);
  const progress = STAGE_PROGRESS[body.stage] ?? 0;
  const isFinal = body.stage === "qc_check";

  const days = Number(body.shippingDays) || 10;
  const eta = new Date(body.orderCreatedAt);
  eta.setDate(eta.getDate() + Math.ceil(days * 1.4));

  const { error: updErr } = await supabase
    .from("dropy_orders")
    .update({
      current_stage: body.stage, progress, status: stageToStatus(body.stage),
      payment_status: body.paymentStatus,
      shipping_days: days,
      estimated_delivery: eta.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      admin_notes: body.adminNotes?.trim() || null,
      ...(isFinal ? { actual_delivery: new Date().toISOString() } : {}),
    })
    .eq("id", id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const { data: events } = await supabase
    .from("dropy_order_events")
    .select("*")
    .eq("order_id", id);

  for (const ev of events ?? []) {
    const evIdx = STAGES.findIndex((s) => s.key === ev.stage);
    if (evIdx < stageIdx && ev.state !== "done") {
      await supabase.from("dropy_order_events").update({ state: "done" }).eq("id", ev.id);
    }
  }

  const ts = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " IST";
  const existing = (events ?? []).find((ev) => ev.stage === body.stage);
  if (existing) {
    await supabase
      .from("dropy_order_events")
      .update({ state: "current", happened_at: ts, note: body.note || existing.note })
      .eq("id", existing.id);
  } else {
    await supabase.from("dropy_order_events").insert({
      order_id: id, stage: body.stage, label: stageInfo.label,
      location: STAGE_LOCATIONS[body.stage] ?? "", happened_at: ts,
      note: body.note || null, state: "current", sort_order: stageIdx,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { id } = await params;
  await supabase.from("dropy_order_events").delete().eq("order_id", id);
  const { error } = await supabase.from("dropy_orders").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
