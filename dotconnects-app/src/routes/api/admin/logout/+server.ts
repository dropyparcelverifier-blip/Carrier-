import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { clearAdminSession } from "$lib/server/admin-session";

export const POST: RequestHandler = async ({ cookies }) => {
  clearAdminSession(cookies);
  return json({ ok: true });
};
