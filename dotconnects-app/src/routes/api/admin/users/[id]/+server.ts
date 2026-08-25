import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAdmin } from "$lib/server/guards";
import { hashPassword } from "$lib/server/password";
import { logAudit } from "$lib/server/audit";

const MIN_PASSWORD_LENGTH = 10;

/**
 * Update a user. Admin only.
 *
 * Three guards here exist because each one is a way to lock YOURSELF out
 * with no recovery short of raw SQL against Supabase.
 */
export const PATCH: RequestHandler = async ({ cookies, params, request }) => {
  const guard = await requireAdmin(cookies);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  const body = await request.json().catch(() => ({}));

  const { data: target } = await supabase
    .from("admin_users")
    .select("id, username, full_name, role, is_active")
    .eq("id", params.id)
    .maybeSingle();

  if (!target) return json({ error: "User not found" }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (typeof body.full_name === "string" && body.full_name.trim()) {
    update.full_name = body.full_name.trim();
  }
  if (body.role === "admin" || body.role === "staff") update.role = body.role;
  if (typeof body.is_active === "boolean") update.is_active = body.is_active;
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < MIN_PASSWORD_LENGTH) {
      return json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
    }
    update.password_hash = hashPassword(body.password);
  }

  const self = target.id === identity.id;

  // 1. You cannot demote yourself — you'd lose admin with no way back.
  if (self && update.role === "staff") {
    return json({ error: "You can't remove your own admin role." }, { status: 409 });
  }
  // 2. You cannot deactivate yourself — instant lockout.
  if (self && update.is_active === false) {
    return json({ error: "You can't deactivate your own account." }, { status: 409 });
  }
  // 3. You cannot remove the LAST active admin, even if it isn't you —
  //    nobody could ever manage users again.
  if (update.role === "staff" || update.is_active === false) {
    const { count } = await supabase
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if ((count ?? 0) <= 1 && target.role === "admin" && target.is_active) {
      return json(
        { error: "This is the last active admin. Promote someone else first." },
        { status: 409 },
      );
    }
  }

  if (Object.keys(update).length === 0) {
    return json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("admin_users")
    .update(update)
    .eq("id", params.id)
    .select("id, username, full_name, role, is_active")
    .single();

  if (error) return json({ error: error.message }, { status: 500 });

  const { password_hash, ...logged } = update as any;
  await logAudit(identity, {
    action: update.is_active === false ? "user.deactivate" : "user.update",
    before: { role: target.role, is_active: target.is_active, full_name: target.full_name },
    after: logged,
    note: password_hash
      ? `Updated "${target.username}" (password reset)`
      : `Updated "${target.username}"`,
  });

  return json({ user: data });
};
