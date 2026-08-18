import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
