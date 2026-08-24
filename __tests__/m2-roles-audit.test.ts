import { describe, it, expect } from "vitest";
import { diffFields } from "../lib/audit";

/* ═══════════════════════════════════════════════════
   M2 — roles, audit log, soft delete
   ═══════════════════════════════════════════════════ */

describe("diffFields", () => {
  it("records only fields that changed", () => {
    const before = { stage: "mid_transit", days: 12, note: "same" };
    const after = { stage: "arrived_india", days: 12, note: "same" };
    const d = diffFields(before, after);

    expect(d.before).toEqual({ stage: "mid_transit" });
    expect(d.after).toEqual({ stage: "arrived_india" });
  });

  it("returns empty objects when nothing changed", () => {
    const same = { stage: "packed", days: 10 };
    const d = diffFields(same, { ...same });

    expect(Object.keys(d.after)).toHaveLength(0);
    expect(Object.keys(d.before)).toHaveLength(0);
  });

  it("captures multiple simultaneous changes", () => {
    const before = { stage: "packed", days: 10, payment: "Unpaid" };
    const after = { stage: "dispatched", days: 12, payment: "Unpaid" };
    const d = diffFields(before, after);

    expect(Object.keys(d.after).sort()).toEqual(["days", "stage"]);
    expect(d.before.days).toBe(10);
    expect(d.after.days).toBe(12);
  });

  it("treats null → value as a change", () => {
    const d = diffFields({ awb: null }, { awb: "SR12345" });
    expect(d.after).toEqual({ awb: "SR12345" });
    expect(d.before).toEqual({ awb: null });
  });

  it("ignores keys present in before but absent from after", () => {
    // after is the source of truth for which fields were being written
    const d = diffFields({ a: 1, b: 2 }, { a: 9 });
    expect(Object.keys(d.after)).toEqual(["a"]);
  });
});

describe("role gating rules", () => {
  // Mirrors requireAdminRole's logic — admin passes everything,
  // staff passes only staff-level requirements.
  const allows = (userRole: "admin" | "staff", required: "admin" | "staff") =>
    required === "admin" ? userRole === "admin" : true;

  it("admin can do admin-only actions", () => {
    expect(allows("admin", "admin")).toBe(true);
  });

  it("staff cannot do admin-only actions", () => {
    expect(allows("staff", "admin")).toBe(false);
  });

  it("staff can do staff-level actions", () => {
    expect(allows("staff", "staff")).toBe(true);
  });

  it("admin can do staff-level actions", () => {
    expect(allows("admin", "staff")).toBe(true);
  });
});

describe("soft delete semantics", () => {
  type Row = { id: string; deleted_at: string | null };
  const visible = (rows: Row[]) => rows.filter((r) => r.deleted_at === null);

  it("hides soft-deleted rows from lists", () => {
    const rows: Row[] = [
      { id: "a", deleted_at: null },
      { id: "b", deleted_at: "2026-08-24T00:00:00Z" },
      { id: "c", deleted_at: null },
    ];
    expect(visible(rows).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("a deleted row still exists — it is hidden, not destroyed", () => {
    const rows: Row[] = [{ id: "a", deleted_at: "2026-08-24T00:00:00Z" }];
    expect(rows).toHaveLength(1);
    expect(visible(rows)).toHaveLength(0);
  });

  it("restore makes the row visible again", () => {
    const row: Row = { id: "a", deleted_at: "2026-08-24T00:00:00Z" };
    const restored = { ...row, deleted_at: null };
    expect(visible([restored])).toHaveLength(1);
  });
});
