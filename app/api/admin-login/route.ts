import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyPassword } from "@/lib/password";
import { createAdminSession } from "@/lib/admin-session";
import { checkRateLimit, clearRateLimit, recordFailedAttempt } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let body: { username?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400 });
    }
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "Missing credentials" }, { status: 400 });
    }

    const limitKey = String(username).trim().toLowerCase();
    const limit = checkRateLimit(limitKey);
    if (limit.limited) {
      const minutes = Math.ceil(limit.retryAfterSeconds / 60);
      return NextResponse.json(
        { ok: false, error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
        { status: 429 },
      );
    }

    const supabase = getSupabaseAdmin();

    // Supabase not configured — dev-only fallback against server-side env
    // vars (never NEXT_PUBLIC_, so never sent to the browser).
    if (!supabase) {
      const ok =
        username === process.env.ADMIN_USERNAME &&
        password === process.env.ADMIN_PASSWORD &&
        !!process.env.ADMIN_USERNAME;
      if (ok) { clearRateLimit(limitKey); await createAdminSession(username); }
      else recordFailedAttempt(limitKey);
      return NextResponse.json({ ok, error: ok ? null : "Invalid username or password" });
    }

    const { data, error } = await supabase
      .from("admin_users")
      .select("password_hash")
      .eq("username", username.trim())
      .limit(1);

    if (error) {
      console.error("Supabase admin-login error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data?.length || !verifyPassword(password, data[0].password_hash)) {
      recordFailedAttempt(limitKey);
      return NextResponse.json({ ok: false, error: "Invalid username or password" });
    }

    clearRateLimit(limitKey);
    await createAdminSession(username.trim());
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Uncaught POST /api/admin-login error:", err);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}
