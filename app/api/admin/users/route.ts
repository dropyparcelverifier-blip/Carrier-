import { NextResponse } from "next/server";
import { requireAdminIdentity } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hashPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * User management — admin only (architecture §5b).
 *
 * Gated because this is the one permission an audit log cannot
 * compensate for: if any user can create accounts, someone can make an
 * account, act, and delete it, leaving the log pointing at a user who no
 * longer exists.
 */

const MIN_PASSWORD_LENGTH = 10;

async function requireAdmin() {
  const identity = await requireAdminIdentity();
  if (!identity) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (identity.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin role required" }, { status: 403 }) };
  }
  return { identity };
}

/** List all users. Password hashes are never returned. */
export async function GET() {
  try {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { data, error } = await supabase
      .from("admin_users")
      .select("id, username, full_name, role, is_active, created_at")
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: data ?? [] });
  } catch (err: any) {
    console.error("Uncaught GET /api/admin/users error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

type CreateBody = {
  username?: string;
  password?: string;
  full_name?: string;
  role?: string;
};

/** Create a user. */
export async function POST(request: Request) {
  try {
    const guard = await requireAdmin();
    if (guard.error) return guard.error;
    const identity = guard.identity!;

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const body = (await request.json()) as CreateBody;
    const username = body.username?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const fullName = body.full_name?.trim() || username;

    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3–32 characters: lowercase letters, numbers, dot, dash or underscore." },
        { status: 400 },
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      );
    }

    // Role defaults to staff, deliberately. A forgotten or malformed role
    // should fail closed to the lower privilege, never grant admin.
    const role = body.role === "admin" ? "admin" : "staff";

    const { data: existing } = await supabase
      .from("admin_users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("admin_users")
      .insert({
        username,
        password_hash: hashPassword(password),
        full_name: fullName,
        role,
        is_active: true,
        created_by: identity.id,
      })
      .select("id, username, full_name, role, is_active, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAudit(identity, {
      action: "user.create",
      after: { username, role, full_name: fullName },
      note: `Created ${role} user "${username}"`,
    });

    return NextResponse.json({ user: data });
  } catch (err: any) {
    console.error("Uncaught POST /api/admin/users error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
