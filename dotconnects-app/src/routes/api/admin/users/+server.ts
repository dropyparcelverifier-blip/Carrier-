import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAdmin } from "$lib/server/guards";
import { hashPassword } from "$lib/server/password";
import { logAudit } from "$lib/server/audit";

const MIN_PASSWORD_LENGTH = 10;

/** List users. Admin only. Never returns password hashes. */
export const GET: RequestHandler = async ({ cookies }) => {
  const guard = await requireAdmin(cookies);
  if (!guard.ok) return guard.response;

  // password_hash is excluded from the SELECT rather than stripped after
  // fetching — a field that never leaves the database can't be leaked by
  // a later refactor that forgets to strip it.
  const { data, error } = await guard.supabase
    .from("admin_users")
    .select("id, username, full_name, role, is_active, created_at")
    .order("created_at", { ascending: true });

  if (error) return json({ error: error.message }, { status: 500 });
  return json({ users: data ?? [] });
};

/** Create a user. Admin only. */
export const POST: RequestHandler = async ({ cookies, request }) => {
  const guard = await requireAdmin(cookies);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  const body = await request.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  const fullName = String(body.full_name ?? "").trim();
  const password = String(body.password ?? "");
  // Anything unrecognised falls to staff. A malformed role fails CLOSED
  // to the lower privilege and never accidentally grants admin.
  const role = body.role === "admin" ? "admin" : "staff";

  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    return json(
      { error: "Username must be 3–32 characters: lowercase letters, digits, dot, dash or underscore." },
      { status: 400 },
    );
  }
  if (!fullName) return json({ error: "Full name is required." }, { status: 400 });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("admin_users")
    .insert({
      username, password_hash: hashPassword(password), full_name: fullName,
      role, is_active: true, created_by: identity.id,
    })
    .select("id, username, full_name, role, is_active, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return json({ error: "That username is already taken." }, { status: 409 });
    }
    return json({ error: error.message }, { status: 500 });
  }

  // The password is never logged — only that a user was made, by whom,
  // with what role.
  await logAudit(identity, {
    action: "user.create",
    after: { username, full_name: fullName, role },
    note: `Created ${role} user "${username}"`,
  });

  return json({ user: data });
};
