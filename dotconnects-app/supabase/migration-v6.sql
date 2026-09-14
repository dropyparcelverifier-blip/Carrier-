-- ═══════════════════════════════════════════════════════════════════
-- Migration v6 — Door Step EDD
--
-- The customer tracking page has always shown ONE date: arrival at the
-- Vashi warehouse. Customers read it as the date the parcel reaches
-- them, which is several courier days later, and the card carried a
-- paragraph of explanation because of it.
--
-- Order Central looks up Shiprocket serviceability for the delivery
-- pincode at push time, takes the MEDIAN courier estimate, rounds up and
-- adds a flat one-day buffer. That whole thing arrives here as a single
-- integer.
--
-- A NUMBER, not a date, deliberately. estimated_delivery is a stored
-- string and moving shipping_days without it once left customers looking
-- at a stale date while every stage stretched around it. A stored
-- doorstep DATE would be a third value that had to move in lockstep with
-- those two, at four separate write sites. A number of days is derived
-- against whatever the Vashi date currently is, so extending a window
-- moves both dates with one write and no chance of disagreement.
--
-- Nullable on purpose. Null is the ordinary case, not an error:
--   * every row written before this migration
--   * a pincode Shiprocket cannot service
--   * a Shiprocket outage at push time
-- All three render exactly what the page rendered before this shipped —
-- one date, no second line. There is no backfill and nothing to migrate.
--
-- Idempotent. Run after migration-v5.sql.
-- ═══════════════════════════════════════════════════════════════════

alter table public.dropy_orders
  add column if not exists doorstep_days smallint;

comment on column public.dropy_orders.doorstep_days is
  'Whole days from Vashi arrival to the customer''s door: flat 1-day '
  'buffer + ceil(median Shiprocket courier estimate for the pincode). '
  'Set once by Order Central at push time. Null means no figure was '
  'available, and the customer is shown the Vashi date alone.';

-- Bounds, not business logic. 1-30 mirrors the cap create-order already
-- applies to shipping_days; anything outside it is a bug upstream, not a
-- delivery estimate, and should fail loudly rather than promise a date
-- eleven weeks out.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'dropy_orders_doorstep_days_check'
  ) then
    alter table public.dropy_orders
      add constraint dropy_orders_doorstep_days_check
      check (doorstep_days is null or (doorstep_days >= 1 and doorstep_days <= 30));
  end if;
end $$;
