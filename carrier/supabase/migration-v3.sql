-- ═══════════════════════════════════════════════════════════════════
-- DotConnects Carrier — Migration v3
-- Section classification as a VIEW, so the admin table can filter,
-- count and paginate server-side without fetching every row.
--
-- Idempotent. Run after migration-v2.sql.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Sectioned view ────────────────────────────────────────────
--
-- Overdue stays COMPUTED, never stored (architecture §6) — this view
-- derives it at query time from order_date + shipping_days, exactly as
-- lib/stage-clock.ts computeOverdue() does. Adding days un-overdues an
-- order on the very next query, with no job to re-run.
--
-- The earlier decision record claimed overdue "cannot be filtered in SQL
-- directly". That was wrong: it is an expression, not a column, but
-- Postgres evaluates it fine. This corrects that.
--
-- ORDER OF THE CASE MATTERS. Arrival events are checked BEFORE the
-- overdue window, because a parcel that arrived late still arrived —
-- putting the window check first would file every late-but-delivered
-- order under Delayed forever.

create or replace view public.dropy_orders_sectioned
with (security_invoker = true)   -- keep RLS applying as the caller, not
                                 -- the view owner; without this the view
                                 -- would quietly bypass row-level security
as
select
  o.*,
  case
    when o.deleted_at is not null                              then 'deleted'
    when o.current_stage = 'damaged'                           then 'damaged'
    when o.delivered_at is not null                            then 'delivered'
    when o.picked_up_at is not null                            then 'picked'
    when o.label_generated_at is not null                      then 'ready'
    when o.current_stage in ('qc_check', 'handed_to_courier')  then 'ready'
    when o.current_stage = 'exception'                         then 'delayed'
    when now() > o.order_date
                 + (o.shipping_days * 1.2 * interval '1 day')  then 'delayed'
    else 'transit'
  end as section,
  -- Exposed separately so the UI can distinguish "held by an admin" from
  -- "ran past its window on its own" — they need different responses.
  (
    o.deleted_at is null
    and o.current_stage not in ('damaged', 'exception', 'qc_check', 'handed_to_courier')
    and o.label_generated_at is null
    and o.picked_up_at is null
    and now() > o.order_date + (o.shipping_days * 1.2 * interval '1 day')
  ) as is_overdue
from public.dropy_orders o;


-- ── 2. Indexes for the section filters ───────────────────────────
-- Each partial index covers one tab's predicate, so a tab query touches
-- only rows that could belong to it rather than scanning the table.

create index if not exists dropy_orders_live_idx
  on public.dropy_orders (created_at desc)
  where deleted_at is null;

create index if not exists dropy_orders_delivered_idx
  on public.dropy_orders (delivered_at desc)
  where deleted_at is null and delivered_at is not null;

create index if not exists dropy_orders_picked_idx
  on public.dropy_orders (picked_up_at desc)
  where deleted_at is null and picked_up_at is not null;

create index if not exists dropy_orders_ready_idx
  on public.dropy_orders (label_generated_at desc)
  where deleted_at is null and label_generated_at is not null;

-- Overdue can't be a partial index predicate: now() is not IMMUTABLE, so
-- Postgres rejects it there. This covers the columns the expression reads
-- so the planner can still work from an index scan.
create index if not exists dropy_orders_window_idx
  on public.dropy_orders (order_date, shipping_days)
  where deleted_at is null
    and label_generated_at is null
    and picked_up_at is null;

-- Search: tracking / order ids and customer lookup from the admin table.
create index if not exists dropy_orders_tracking_idx
  on public.dropy_orders (tracking_id) where deleted_at is null;
create index if not exists dropy_orders_dropy_id_idx
  on public.dropy_orders (dropy_order_id) where deleted_at is null;
create index if not exists dropy_orders_mobile_idx
  on public.dropy_orders (customer_mobile) where deleted_at is null;


-- ── 3. Verification ──────────────────────────────────────────────
-- Every non-deleted order must land in exactly one section, and the
-- counts must sum to the total. Run after applying:
--
--   select section, count(*) from public.dropy_orders_sectioned
--   where section <> 'deleted' group by section order by section;
--
--   select count(*) from public.dropy_orders where deleted_at is null;
--
-- The two must agree.
