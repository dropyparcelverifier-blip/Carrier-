-- ═══════════════════════════════════════════════════════════════════
-- Migration v11 — the Indian courier's own delivery date
--
-- Once a parcel is handed to Shiprocket or Velocity, the date that
-- matters is theirs, not ours. DotConnects' estimate covered the US leg
-- and stops being a promise the moment the box changes hands.
--
-- The customer's page has been showing the DotConnects date under
-- "Arriving at your address" long after the courier gave a better one,
-- or showing nothing at all and leading with an OUT FOR DELIVERY pill
-- where the date belongs.
--
-- Velocity sends both figures on every webhook — original_edd, the date
-- promised at booking, and estimated_delivery_date, what it now expects.
-- Both are kept: the pair is what makes a courier's punctuality
-- measurable, rather than taking their quote on trust.
--
-- Idempotent. Run before deploying the code that reads these columns.
-- ═══════════════════════════════════════════════════════════════════

alter table public.dropy_orders
  add column if not exists last_mile_edd timestamptz;

alter table public.dropy_orders
  add column if not exists last_mile_original_edd timestamptz;

comment on column public.dropy_orders.last_mile_edd is
  'What the Indian courier currently expects. Shown to the customer in '
  'place of the DotConnects date once the parcel has been handed over.';

comment on column public.dropy_orders.last_mile_original_edd is
  'What the courier promised when the shipment was booked. Kept beside '
  'the current figure so lateness is measurable rather than assumed.';

-- ─── verification ──────────────────────────────────────────────────
--   select column_name, data_type from information_schema.columns
--   where  table_name = 'dropy_orders'
--     and  column_name like 'last_mile_%edd%';
--
-- Expect two rows, both timestamptz.
