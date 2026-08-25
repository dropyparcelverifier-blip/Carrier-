import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { AdminIdentity } from "@/lib/admin-session";

/**
 * Audit log — architecture §5.4.
 *
 * Every mutating action records who did it, to which order, and when.
 * Views are NOT logged (Gate 2 decision) — that would have been ~10x the
 * volume for the log least likely to be read.
 *
 * Not every actor is a person. Orders arrive from the DOC bridge with no
 * session, and webhooks move stages with no human involved. Those log as
 * actor_type "system" so the log has no gaps precisely where automation
 * acts.
 */

export type AuditAction =
  | "order.create"
  | "order.update"
  | "order.stage_change"
  | "order.delete"
  | "order.restore"
  | "order.mark_damaged"
  | "order.mark_delivered"
  | "order.add_days"
  | "order.mark_delayed"
  | "order.tracking_generated"
  | "user.create"
  | "user.update"
  | "user.deactivate"
  | "seed.run";

/** Known system actors. Using a union rather than free text keeps the
 *  log filterable — "show me everything DOC did" needs stable names. */
export type SystemActor =
  | "Order Central (DOC)"
  | "Shiprocket webhook"
  | "Velocity webhook";

type AuditInput = {
  action: AuditAction;
  orderId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  note?: string | null;
};

/**
 * Writes an audit row for a logged-in human.
 *
 * Deliberately swallows its own errors: an audit write failing must never
 * take down the action it was recording. A lost log line is bad; a failed
 * order update because logging broke is worse. Failures are logged to the
 * server console so they're still visible.
 */
export async function logAudit(
  actor: AdminIdentity,
  input: AuditInput,
): Promise<void> {
  await writeAuditRow({
    actor_type: "user",
    actor_id: actor.id,
    actor_name: actor.username,
    ...toRow(input),
  });
}

/** Writes an audit row for a non-human actor (DOC bridge, a webhook). */
export async function logSystemAudit(
  actor: SystemActor,
  input: AuditInput,
): Promise<void> {
  await writeAuditRow({
    actor_type: "system",
    actor_id: null,
    actor_name: actor,
    ...toRow(input),
  });
}

function toRow(input: AuditInput) {
  return {
    action: input.action,
    order_id: input.orderId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    note: input.note ?? null,
  };
}

async function writeAuditRow(row: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return; // demo/dev mode — nothing to write to

  const { error } = await supabase.from("admin_audit_log").insert(row);
  if (error) {
    console.error("[audit] failed to write audit row", {
      action: row.action,
      actor: row.actor_name,
      error: error.message,
    });
  }
}

/**
 * Builds a before/after pair containing ONLY the fields that actually
 * changed. Storing whole rows would bloat the log and bury the change
 * that matters under twenty unchanged columns.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      b[key] = before[key];
      a[key] = after[key];
    }
  }
  return { before: b, after: a };
}
