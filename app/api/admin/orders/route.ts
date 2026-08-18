import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("dropy_orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

type CreateBody = {
  us_order_id: string; dropy_order_id: string; tracking_id: string;
  customer_name: string; customer_mobile: string; customer_email: string;
  customer_address: string; customer_city: string; customer_pincode: string;
  shipping_days: number; shipping_mode: string;
  carrier_name: string; awb_number: string; admin_notes: string;
  payment_status: string;
  items: { name: string; qty: number; weight_g: number; sku?: string }[];
};

export async function POST(request: Request) {
  const admin = await requireAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = (await request.json()) as CreateBody;

  // Server-side validation — this route is the real trust boundary now, not
  // just the form in AdminClient.tsx.
  if (!body.customer_name?.trim()) {
    return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
  }
  if (!/^\d{10}$/.test(body.customer_mobile?.trim() ?? "")) {
    return NextResponse.json({ error: "Mobile must be exactly 10 digits." }, { status: 400 });
  }
  if (!body.customer_city?.trim()) {
    return NextResponse.json({ error: "City is required." }, { status: 400 });
  }
  const validItems = (body.items ?? []).filter((it) => it.name?.trim());
  if (!validItems.length) {
    return NextResponse.json({ error: "Add at least one item with a name." }, { status: 400 });
  }
  if (!/^\d{3}-\d{7}-\d{7}$/.test(body.us_order_id?.trim() ?? "")) {
    return NextResponse.json(
      { error: "US Order ID must be in format: 333-7777777-7777777" },
      { status: 400 },
    );
  }
  const days = Number(body.shipping_days);
  if (!days || days < 1 || days > 30) {
    return NextResponse.json({ error: "Shipping days must be between 1 and 30." }, { status: 400 });
  }

  const mappedItems = validItems.map((it) => ({
    name: it.name.trim(), qty: Number(it.qty) || 1,
    weight_g: Number(it.weight_g) || 0, sku: it.sku?.trim() || undefined,
  }));
  const totalW = mappedItems.reduce((s, it) => s + it.weight_g * it.qty, 0) / 1000;
  const totalN = mappedItems.reduce((s, it) => s + it.qty, 0);
  const eta = new Date();
  eta.setDate(eta.getDate() + Math.ceil(days * 1.4));

  const { data, error: insertErr } = await supabase
    .from("dropy_orders")
    .insert({
      us_order_id: body.us_order_id.trim(),
      dropy_order_id: body.dropy_order_id, tracking_id: body.tracking_id,
      customer_name: body.customer_name.trim(), customer_mobile: body.customer_mobile.trim(),
      customer_email: body.customer_email?.trim() || null,
      customer_address: body.customer_address?.trim() || null,
      customer_city: body.customer_city.trim(), customer_pincode: body.customer_pincode?.trim() || null,
      items: mappedItems, total_weight_kg: Math.round(totalW * 100) / 100, total_items: totalN,
      shipping_days: days, shipping_mode: body.shipping_mode,
      current_stage: "order_placed", status: "Order Placed", progress: 0,
      estimated_delivery: eta.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      carrier_name: body.carrier_name?.trim() || "Dropy Logistics",
      awb_number: body.awb_number?.trim() || null, admin_notes: body.admin_notes?.trim() || null,
      payment_status: body.payment_status,
    })
    .select();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  const order = data?.[0];
  if (order) {
    const ts = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " IST";
    await supabase.from("dropy_order_events").insert({
      order_id: order.id, stage: "order_placed", label: "Order placed",
      location: "dropy.in", happened_at: ts,
      note: "Order confirmed.", state: "current", sort_order: 0,
    });
  }

  return NextResponse.json({ order });
}
