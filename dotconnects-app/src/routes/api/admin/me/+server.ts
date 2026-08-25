import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireAdminIdentity } from "$lib/server/admin-session";

/**
 * Who am I — lets the UI decide which controls to render.
 *
 * CONVENIENCE, not security. Every privileged route checks the role
 * independently on the server. Anyone can call this and lie to their own
 * browser about the answer; it changes nothing about what the server
 * accepts. Hiding a button is courtesy to staff, not protection.
 */
export const GET: RequestHandler = async ({ cookies }) => {
  const identity = await requireAdminIdentity(cookies);
  if (!identity) return json({ error: "Unauthorized" }, { status: 401 });
  return json({ username: identity.username, role: identity.role });
};
