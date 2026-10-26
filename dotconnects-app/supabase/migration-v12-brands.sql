-- migration-v12-brands.sql — DOT Supabase (lhqastlbmeuvujroowvm)
-- Brand admin accounts (Rudra). Run BEFORE pushing the code.
--
-- Additive only:
--   * dropy_orders.brand  — every existing row and every future DOC push
--                           gets 'dropy' from the default. DOC sends nothing new.
--   * admin_users.brand   — null = Dropy team (everyone today). 'rudra' = Rudra login.
--   * dropy_orders_sectioned — recreated with the SAME columns in the SAME
--                           order, plus `brand` appended at the end.
--                           (CREATE OR REPLACE VIEW only allows adding at the end.)

begin;

alter table dropy_orders add column if not exists brand text not null default 'dropy';
alter table admin_users  add column if not exists brand text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dropy_orders_brand_check') then
    alter table dropy_orders add constraint dropy_orders_brand_check check (brand in ('dropy', 'rudra'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'admin_users_brand_check') then
    alter table admin_users add constraint admin_users_brand_check check (brand is null or brand in ('rudra'));
  end if;
end $$;

create index if not exists dropy_orders_brand_idx on dropy_orders (brand) where deleted_at is null;

create or replace view dropy_orders_sectioned as
 SELECT id,
    dropy_order_id,
    tracking_id,
    customer_name,
    customer_mobile,
    customer_email,
    customer_address,
    customer_city,
    customer_pincode,
    items,
    total_weight_kg,
    total_items,
    declared_value_usd,
    shipping_days,
    shipping_mode,
    current_stage,
    status,
    progress,
    order_date,
    estimated_delivery,
    actual_delivery,
    admin_notes,
    carrier_name,
    awb_number,
    created_at,
    updated_at,
    us_order_id,
    payment_status,
    route_key,
    origin_country,
    timing_seed,
    last_mile_courier,
    last_mile_awb,
    last_mile_tracking_url,
    clock_anchor_stage,
    clock_anchor_at,
    deleted_at,
    deleted_by,
    replacement_of,
    label_generated_at,
    picked_up_at,
    delivered_at,
    shopify_order_id,
    shopify_fulfillment_id,
    shopify_synced_at,
    shopify_sync_error,
        CASE
            WHEN deleted_at IS NOT NULL THEN 'deleted'::text
            WHEN current_stage = 'damaged'::text THEN 'damaged'::text
            WHEN delivered_at IS NOT NULL THEN 'delivered'::text
            WHEN picked_up_at IS NOT NULL THEN 'picked'::text
            WHEN label_generated_at IS NOT NULL THEN 'ready'::text
            WHEN current_stage = ANY (ARRAY['qc_check'::text, 'handed_to_courier'::text]) THEN 'ready'::text
            WHEN current_stage = 'exception'::text THEN 'delayed'::text
            WHEN now() > (order_date + (shipping_days::numeric * 1.2)::double precision * '1 day'::interval) THEN 'delayed'::text
            ELSE 'transit'::text
        END AS section,
    deleted_at IS NULL AND (current_stage <> ALL (ARRAY['damaged'::text, 'exception'::text, 'qc_check'::text, 'handed_to_courier'::text])) AND label_generated_at IS NULL AND picked_up_at IS NULL AND now() > (order_date + (shipping_days::numeric * 1.2)::double precision * '1 day'::interval) AS is_overdue,
    brand
   FROM dropy_orders o;

commit;
