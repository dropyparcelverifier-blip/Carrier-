import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await clearAdminSession();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Uncaught POST /api/admin-logout error:", err);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}
