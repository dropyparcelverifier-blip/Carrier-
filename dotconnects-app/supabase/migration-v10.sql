-- ═══════════════════════════════════════════════════════════════════
-- Migration v10 — the delay pause
--
-- THE PROBLEM. "Delayed" was a flag with no arithmetic behind it. The
-- stage froze on the customer's page, but the clock underneath kept
-- running and estimated_delivery never moved. So a parcel held four days
-- silently caught itself up the moment the hold cleared — every stage it
-- had "missed" appeared at once, and the delivery date was still the one
-- promised before anything went wrong.
--
-- THE FIX. Two columns and one rule, shared by the clock and by etaFor:
--
--     effective now = (delayed_at ?? now) − delay_total_ms
--     Dropy EDD     = order_date + calendarDays(shipping_days) + delay_total
--
-- While delayed_at is set the clock is pinned at the instant of the
-- pause. On resume the elapsed time is added to delay_total_ms, so the
-- clock picks up exactly where it stopped and every stage — plus both
-- dates — shifts out by the length of the hold. See lib/journey.ts,
-- which now owns the pause beside damaged and cancelled rather than
-- keeping a fourth copy of the rule.
--
-- NO BACKFILL, DELIBERATELY. Rows currently sitting at 'exception' have
-- no honest delayed_at — the flag never recorded when it was set. An
-- approximate timestamp would move real customer dates by a guessed
-- number of days. Clear those rows first (query at the bottom), then run
-- this.
--
-- Idempotent. Run after migration-v9.sql, BEFORE deploying the code:
-- both payload builders select these columns, and a missing column
-- errors the whole PostgREST query and takes the tracking page down.
-- ═══════════════════════════════════════════════════════════════════

alter table public.dropy_orders
  add column if not exists delayed_at timestamptz;

alter table public.dropy_orders
  add column if not exists delay_total_ms bigint not null default 0;

comment on column public.dropy_orders.delayed_at is
  'When the clock was paused, or null while it is running. The stage '
  'clock is evaluated at this instant minus delay_total_ms, which pins '
  'the journey where the parcel actually stopped. Cleared on resume, '
  'when the elapsed time is folded into delay_total_ms. Not the same '
  'thing as DOC''s dot_splits[].delayed_at, which records per-parcel '
  'that a hold was placed; this one is the pause itself.';

comment on column public.dropy_orders.delay_total_ms is
  'Total milliseconds this parcel has spent paused, across every hold. '
  'Subtracted from now to get effective now for the clock, and added to '
  'the shipping window to get both customer dates. Never decreases.';

-- A pause that is running must have a start. Nothing else is meaningful,
-- and a null delayed_at on an 'exception' row is exactly the state that
-- made the old flag unrecoverable.
alter table public.dropy_orders
  drop constraint if exists dropy_orders_delay_total_nonneg;

alter table public.dropy_orders
  add constraint dropy_orders_delay_total_nonneg
  check (delay_total_ms >= 0);

-- ─── run this BEFORE the migration ─────────────────────────────────
-- The currently-flagged parcels, which have no honest pause timestamp.
-- Resume each from DOC, or clear them here:
--
--   select id, tracking_id, current_stage, order_date, shipping_days
--   from   public.dropy_orders
--   where  current_stage = 'exception'
--     and  deleted_at is null;
--
--   update public.dropy_orders
--   set    current_stage = 'mid_transit'      -- or the true stage
--   where  current_stage = 'exception';
--
-- ─── verification, after ───────────────────────────────────────────
--   select column_name, data_type, column_default, is_nullable
--   from   information_schema.columns
--   where  table_name = 'dropy_orders'
--     and  column_name in ('delayed_at', 'delay_total_ms');
--
-- Expect two rows: delayed_at timestamptz nullable, delay_total_ms
-- bigint not null default 0.
--
--   select count(*) filter (where delayed_at is not null) as paused_now,
--          count(*) filter (where delay_total_ms > 0)     as ever_paused,
--          count(*) filter (where current_stage = 'exception') as flagged
--   from   public.dropy_orders where deleted_at is null;
--
-- Expect 0, 0, 0 immediately after running this on a cleared table.
