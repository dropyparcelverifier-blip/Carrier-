-- ═══════════════════════════════════════════════════════════════════
-- Migration v9 — held_at, and the history a held parcel kept losing
--
-- THE PROBLEM. Most stages on a customer's timeline are not stored rows.
-- Two real events exist per order — the booking, and the handover once it
-- happens — and everything between is generated at read time from the
-- clock. That backfill is driven off the parcel's current stage.
--
-- Cancelling or damaging overwrites current_stage with the hold key. So
-- the backfill had nothing to draw toward, and every stage the box had
-- genuinely passed vanished from the trail. A customer whose parcel was
-- damaged three weeks into its journey saw the booking, the damage, and
-- nothing in between.
--
-- Worse, the stage it had REACHED is not recoverable from the row at all.
-- It was in current_stage, and current_stage is what got overwritten.
--
-- THE FIX. One nullable timestamp recording when the journey stopped.
-- The clock can then be asked what stage the parcel was at THEN rather
-- than now, and the history replays exactly as it stood at that moment.
--
-- Only damaged and exception use it. A CANCELLED parcel is not frozen:
-- nobody stops a freighter because an order was cancelled, so it keeps
-- travelling and caps at the Vashi warehouse instead. See lib/journey.ts.
--
-- BACKFILL. Existing held rows take their timestamp from the hold event
-- migration-v8 wrote for them, which is the closest real record of when
-- it happened. Rows with no such event keep null and fall back to the old
-- behaviour — no worse than before, and there are only a handful.
--
-- Idempotent. Run after migration-v8.sql, BEFORE deploying the code.
-- ═══════════════════════════════════════════════════════════════════

alter table public.dropy_orders
  add column if not exists held_at timestamptz;

comment on column public.dropy_orders.held_at is
  'When the journey stopped, for a parcel marked damaged or exception. '
  'The clock is evaluated at this instant to replay the stages the parcel '
  'had passed, because current_stage was overwritten with the hold key '
  'and the stage it reached is otherwise unrecoverable. Null on cancelled '
  'rows by design: a cancelled parcel is still travelling to Vashi.';

-- Take the time from the hold event rather than inventing one.
update public.dropy_orders o
set    held_at = e.happened_at::timestamptz
from   public.dropy_order_events e
where  e.order_id = o.id
  and  e.stage = o.current_stage
  and  o.current_stage in ('damaged', 'exception')
  and  o.held_at is null
  /* happened_at is TEXT, not a timestamp, and rows written before the
     ISO change carry an IST DISPLAY string ("10 Sept 2026, 18:01 IST")
     that will not cast. Without this guard the whole statement errors —
     and because the ALTER above runs in the same transaction, the column
     rolls back with it and the deploy has no column to select. */
  and  e.happened_at ~ '^\d{4}-\d{2}-\d{2}T';

-- ─── verification ──────────────────────────────────────────────────
--   select tracking_id, current_stage, held_at, order_date, shipping_days
--   from public.dropy_orders
--   where current_stage in ('damaged', 'exception', 'cancelled')
--   order by created_at desc;
--
-- Expect held_at set on damaged/exception rows that have a hold event,
-- and null on cancelled ones — that is correct, not a gap.
