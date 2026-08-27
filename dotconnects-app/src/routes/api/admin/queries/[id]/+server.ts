import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireStaff } from "$lib/server/guards";
import { logAudit } from "$lib/server/audit";

const STATUSES = ["open", "in_progress", "resolved", "spam"] as const;

/**
 * Move an enquiry through the workflow, or record that it was shared
 * with the cargo partner.
 *
 * `shared_at` is a deliberate field rather than a note: the data
 * agreement is "we share every enquiry", and a timestamp per row is what
 * makes that checkable rather than a claim.
 */
export const PATCH: RequestHandler = async ({ cookies, params, request }) => {
  const guard = await requireStaff(cookies);
  if (!guard.ok) return guard.response;
  const { supabase, identity } = guard;

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status)) {
      return json({ error: `status must be one of: ${STATUSES.join(", ")}` }, { status: 400 });
    }
    update.status = body.status;
    // Stamped once, when it first reaches resolved. Re-opening and
    // re-resolving shouldn't overwrite the original date.
    update.resolved_at = body.status === "resolved" ? new Date().toISOString() : null;
  }
  if (typeof body.internal_note === "string") update.internal_note = body.internal_note.trim() || null;
  if (body.shared === true) update.shared_at = new Date().toISOString();
  if (body.shared === false) update.shared_at = null;

  if (Object.keys(update).length === 0) {
    return json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data: before } = await supabase
    .from("business_queries")
    .select("status, business_name, shared_at")
    .eq("id", params.id)
    .maybeSingle();

  if (!before) return json({ error: "Enquiry not found" }, { status: 404 });

  const { error } = await supabase.from("business_queries").update(update).eq("id", params.id);
  if (error) return json({ error: error.message }, { status: 500 });

  await logAudit(identity, {
    action: "enquiry.update",
    before: { status: before.status, shared_at: before.shared_at },
    after: update,
    note: `${before.business_name}: ${before.status} → ${update.status ?? before.status}`,
  });

  return json({ ok: true });
};
