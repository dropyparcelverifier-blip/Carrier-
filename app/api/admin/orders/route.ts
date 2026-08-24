import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { insertNewOrder, validateNewOrder, type NewOrderInput } from "@/lib/create-order";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    // Soft-deleted orders (architecture §5.1) stay in the table but must
    // not appear in the working list. Restoring one is an explicit admin
    // action, not a side effect of browsing.
    const { data, error } = await supabase
      .from("dropy_orders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase GET orders error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ orders: data ?? [] });
  } catch (err: any) {
    console.error("Uncaught GET /api/admin/orders error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    let body: NewOrderInput;
    try {
      body = (await request.json()) as NewOrderInput;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    // Server-side validation — this route is the real trust boundary now, not
    // just the form in AdminClient.tsx.
    const validationErr = validateNewOrder(body);
    if (validationErr) return NextResponse.json({ error: validationErr }, { status: 400 });

    const result = await insertNewOrder(body);
    if (result.error !== undefined) return NextResponse.json({ error: result.error }, { status: 500 });

    return NextResponse.json({ order: result.order });
  } catch (err: any) {
    console.error("Uncaught POST /api/admin/orders error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
