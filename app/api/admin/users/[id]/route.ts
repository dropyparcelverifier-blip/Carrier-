import { NextResponse } from "next/server";
import { requireAdminIdentity } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hashPassword } from "@/lib/password";
import { logAudit, diffFields } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const MIN_PASSWORD_LENGTH = 10;

type PatchBody = {
  full_name?: string;
  role?: string;
  is_active?: boolean;
  password?: string;
};

/**
 * Update a user — rename, change role, reset password, deactivate.
 * Admin only.
 *
 * Users are deactivated, never deleted. A deleted user would orphan every
 * audit row pointing at them, which defeats the purpose of having a log.
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const identity = await requireAdminIdentity();
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (identity.role !== "admin") {
      return NextResponse.json({ error: "Admin role required" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

    const { id } = await params;
    const body = (await request.json()) as PatchBody;

    const { data: existing } = await supabase
      .from("admin_users")
      .select("id, username, full_name, role, is_active")
      .eq("id", id)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Guard against locking yourself out. Demoting or deactivating your
    // own account leaves nobody able to manage users — and there is no
    // recovery path short of SQL access.
    const isSelf = identity.id === id;
    if (isSelf && (body.role === "staff" || body.is_active === false)) {
      return NextResponse.json(
        { error: "You cannot demote or deactivate your own account." },
        { status: 400 },
      );
    }

    // Never leave zero active admins. Same failure mode, reached from a
    // different direction.
    if ((body.role === "staff" || body.is_active === false) && existing.role === "admin") {
      const { count } = await supabase
        .from("admin_users")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true);

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last active admin." },
          { status: 400 },
        );
      }
    }

    const update: Record<string, unknown> = {};
    if (body.full_name !== undefined) update.full_name = body.full_name.trim();
    if (body.role !== undefined) update.role = body.role === "admin" ? "admin" : "staff";
    if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);

    if (body.password !== undefined) {
      if (body.password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
          { status: 400 },
        );
      }
      update.password_hash = hashPassword(body.password);
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const { error } = await supabase.from("admin_users").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // The password hash must never reach the audit log — record only that
    // it changed.
    const passwordChanged = update.password_hash !== undefined;
    delete update.password_hash;

    const changed = diffFields(
      { full_name: existing.full_name, role: existing.role, is_active: existing.is_active },
      update,
    );

    await logAudit(identity, {
      action: body.is_active === false ? "user.deactivate" : "user.update",
      before: changed.before,
      after: changed.after,
      note: passwordChanged
        ? `Password reset for "${existing.username}"`
        : `Updated "${existing.username}"`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Uncaught PATCH /api/admin/users/[id] error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
