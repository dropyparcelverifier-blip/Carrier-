-- ═══════════════════════════════════════════════════════════════════
-- Migration v8 — hold states on the customer's trail
--
-- ─── part 1: the constraint ────────────────────────────────────────
-- dropy_order_events.stage permitted the 14 journey stages plus
-- 'exception' and 'damaged'. It did NOT permit 'cancelled'.
--
-- That is the third time this has happened. 'damaged' and 'cancelled'
-- were dead on arrival against dropy_orders.current_stage; 'Paid' was
-- rejected by payment_status after validation had already passed; and
-- here the same value is missing again on a different table. Every one
-- shipped green and failed only on a real write.
--
-- tests/constraint-drift.test.ts now covers this table too, so a stage
-- the code can write and the database cannot store is a red test rather
-- than a silent insert failure in production.
--
-- ─── part 2: the backfill ──────────────────────────────────────────
-- Parcels already cancelled or damaged have no trail entry at all. The
-- endpoints wrote current_stage and an audit row and never touched
-- dropy_order_events, so their timelines still show one entry from the
-- day the order was created — "Booking confirmed · Order confirmed." A
-- customer told their parcel was cancelled saw a page whose only update
-- said it was on its way.
--
-- TIMESTAMP CAVEAT, on purpose. There is no cancelled_at or damaged_at
-- column, and the audit log holds NOTHING for these actions (see part 3
-- of this file's sibling change in audit.ts). updated_at is the closest
-- honest anchor: for a parcel cancelled and untouched since, it IS the
-- cancellation time. For one edited afterwards it is later than the
-- truth. That is recorded here rather than papered over — a plausible
-- invented timestamp would be worse than an approximate real one.
--
-- Idempotent. Run after migration-v7-constraints.sql, and BEFORE
-- deploying the code that writes these events.
-- ═══════════════════════════════════════════════════════════════════

-- ─── part 1 ────────────────────────────────────────────────────────
do $$
begin
  alter table public.dropy_order_events
    drop constraint if exists dropy_order_events_stage_check;

  alter table public.dropy_order_events
    add constraint dropy_order_events_stage_check
    check (stage = any (array[
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

-- ─── part 2 ────────────────────────────────────────────────────────
-- Nothing on the journey stays "current" once the journey has ended,
-- or the last real stage keeps its live styling under a cancellation.
update public.dropy_order_events e
set    state = 'done'
from   public.dropy_orders o
where  e.order_id = o.id
  and  o.current_stage in ('cancelled', 'damaged')
  and  e.state = 'current'
  and  e.stage not in ('cancelled', 'damaged');

-- One entry per held parcel that lacks one. The NOT EXISTS is what
-- makes re-running this safe.
insert into public.dropy_order_events
  (order_id, stage, label, location, happened_at, note, state, sort_order)
select
  o.id,
  o.current_stage,
  case o.current_stage
    when 'cancelled' then 'Order cancelled'
    else 'Parcel damaged in transit'
  end,
  'DotConnects Logistics',
  coalesce(o.updated_at, now()),
  case o.current_stage
    when 'cancelled' then 'Order Cancelled by Vendor.'
    else 'This parcel was damaged on the way to India. Our team is handling it.'
  end,
  'exception',
  99
from public.dropy_orders o
where o.current_stage in ('cancelled', 'damaged')
  and o.deleted_at is null
  and not exists (
    select 1 from public.dropy_order_events e
    where e.order_id = o.id
      and e.stage = o.current_stage
  );

-- ─── verification ──────────────────────────────────────────────────
-- Expect one row per held parcel, and zero in the second query.
--
--   select o.tracking_id, o.current_stage, e.label, e.note, e.happened_at
--   from public.dropy_orders o
--   join public.dropy_order_events e
--     on e.order_id = o.id and e.stage = o.current_stage
--   where o.current_stage in ('cancelled', 'damaged')
--   order by e.happened_at desc;
--
--   select o.tracking_id
--   from public.dropy_orders o
--   where o.current_stage in ('cancelled', 'damaged')
--     and o.deleted_at is null
--     and not exists (
--       select 1 from public.dropy_order_events e
--       where e.order_id = o.id and e.stage = o.current_stage
--     );
