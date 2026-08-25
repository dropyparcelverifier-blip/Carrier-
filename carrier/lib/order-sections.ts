/**
 * Admin table sections — architecture §6, wireframe A2.
 *
 * The section a row belongs to is decided in SQL by the
 * dropy_orders_sectioned view (supabase/migration-v3.sql), not here.
 * This module holds the shared vocabulary and the pagination contract so
 * the route and the UI cannot drift apart on section names.
 */

export const SECTIONS = [
  { key: "transit", label: "Transit" },
  { key: "ready", label: "Ready to pick" },
  { key: "picked", label: "Picked" },
  { key: "delivered", label: "Delivered" },
  { key: "delayed", label: "Delayed" },
  { key: "damaged", label: "Damaged" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

export const SECTION_KEYS = SECTIONS.map((s) => s.key) as readonly SectionKey[];

export function isSectionKey(v: unknown): v is SectionKey {
  return typeof v === "string" && (SECTION_KEYS as readonly string[]).includes(v);
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/**
 * Clamp a requested page size.
 *
 * Capped because the page size arrives from a query string: without a
 * ceiling, `?pageSize=100000` turns the pagination we just built back
 * into the unbounded fetch it replaced.
 */
export function clampPageSize(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(n), MAX_PAGE_SIZE);
}

export function clampPage(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/** Postgres range is inclusive at both ends. */
export function pageRange(page: number, pageSize: number): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function totalPages(count: number, pageSize: number): number {
  if (count <= 0) return 1;
  return Math.ceil(count / pageSize);
}

/**
 * Which column a section is most naturally ordered by.
 *
 * Delivered and Picked read better newest-event-first — you want the
 * ones that just landed, not the ones ordered longest ago. Transit and
 * Delayed order by creation, oldest first for Delayed so the parcel
 * that's been stuck longest is at the top rather than buried.
 */
export function sectionOrder(section: SectionKey): { column: string; ascending: boolean } {
  switch (section) {
    case "delivered": return { column: "delivered_at", ascending: false };
    case "picked":    return { column: "picked_up_at", ascending: false };
    case "ready":     return { column: "label_generated_at", ascending: false };
    case "delayed":   return { column: "order_date", ascending: true };
    default:          return { column: "created_at", ascending: false };
  }
}
