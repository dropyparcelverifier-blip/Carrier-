-- ═══════════════════════════════════════════════════════════════════
-- Migration v7 — the check constraints, written down at last
--
-- dropy_orders was created outside version control. Its columns, its
-- indexes and these two constraints have only ever existed in the live
-- Supabase project. The only written record was a fragment in
-- dot-findings-14-sept.md, and that fragment was already WRONG: it lists
-- eight permitted status values and omits 'Cancelled', which live has.
-- Anyone rebuilding from it would recreate a constraint that silently
-- kills cancel-tracking, the exact failure that doc exists to prevent.
--
-- These lists are the LIVE definitions, read back out of pg_constraint
-- on 14 Sept 2026, not retyped from anywhere. They are what the database
-- actually enforces today, so running this file changes nothing. That is
-- the point: it turns an undocumented state into a checked-in one.
--
-- Idempotent. Safe to run repeatedly. Existing rows already satisfy both
-- lists, so the revalidation on ADD CONSTRAINT is a formality.
--
-- ─── the standing problem this does NOT solve ───────────────────────
-- These lists are still a hand-kept copy of TypeScript constants:
-- STAGES in src/lib/types.ts and the return values of stageToStatus in
-- src/lib/admin-stages.ts. They have fallen out of step twice. Both
-- 'damaged' and 'cancelled' shipped in code while the table rejected
-- them, and nothing failed until a real write; 'Paid' was rejected the
-- same way for payment_status.
--
-- The durable fix is to GENERATE these lists from the TypeScript, or to
-- drop the checks and enforce the values in the code that already knows
-- them. Until then, adding a stage or a status in code means editing
-- this file in the same commit.
-- ═══════════════════════════════════════════════════════════════════

-- ─── current_stage ─────────────────────────────────────────────────
-- 14 canonical journey stages, then the three hold states. A hold state
-- is not a point on the route: the clock must not advance past it, and
-- effectiveOrderStage in src/lib/order-routes.ts guards all three.
do $$
begin
  alter table public.dropy_orders
    drop constraint if exists dropy_orders_current_stage_check;

  alter table public.dropy_orders
    add constraint dropy_orders_current_stage_check
    check (current_stage = any (array[
      -- the journey, in order
      'order_placed',
      'processing',
      'packed',
      'dispatched',
      'at_us_airport',
      'us_customs_cleared',
      'in_transit_departed',
      'mid_transit',
      'arrived_india',
      'indian_customs',
      'customs_cleared',
      'at_vashi_warehouse',
      'qc_check',
      'handed_to_courier',
      -- hold states, not points on it
      'exception',
      'damaged',
      'cancelled'
    ]::text[]));
end $$;

-- ─── status ────────────────────────────────────────────────────────
-- The display string. Written alongside current_stage, never on its own.
-- The customer page derives its damaged and cancelled branches from this
-- value, so a missing entry here does not just reject a write -- it
-- makes a whole customer-facing state unreachable.
do $$
begin
  alter table public.dropy_orders
    drop constraint if exists dropy_orders_status_check;

  alter table public.dropy_orders
    add constraint dropy_orders_status_check
    check (status = any (array[
      'Order Placed',
      'Processing',
      'In Transit',
      'Customs Clearance',
      'At Warehouse',
      'Received',
      'Forwarded to Courier',
      -- hold states
      'Damaged in transit',
      'Cancelled'
    ]::text[]));
end $$;

-- ─── verification ──────────────────────────────────────────────────
-- Run this after, and compare against the code. 17 stages, 9 statuses.
--
--   select c.conname,
--          trim(both '''' from replace(v, '::text', '')) as allowed_value
--   from pg_constraint c
--   cross join lateral unnest(
--     string_to_array(
--       split_part(split_part(pg_get_constraintdef(c.oid), 'ARRAY[', 2), ']', 1),
--       ', '
--     )
--   ) as v
--   where c.conname in ('dropy_orders_status_check',
--                       'dropy_orders_current_stage_check')
--   order by 1, 2;
