-- ═══════════════════════════════════════════════════════════════════════
--  Order IDs on the Attention list
--
--  ADDS    : one column to an existing view
--  DELETES : nothing. No table is touched.
--
--  Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════

-- The view never carried order_ids, so the Attention screen had no way to
-- link a parcel to its order on Amazon.
DROP VIEW IF EXISTS attention_parcels;
CREATE VIEW attention_parcels AS
SELECT
    p.tracking_number, p.carrier, p.po_number, p.order_ids, p.item_count,
    p.order_date, p.order_on, p.shipment_date, p.ship_date, p.delivery_on,
    p.delivery_state, p.delivery_status_raw, p.warehouse_received,
    p.attention_state, p.stream,
    (CURRENT_DATE - p.order_on) AS days_open,
    CASE
        WHEN p.delivery_state = 'not_delivered' THEN 'not_delivered'
        WHEN p.delivery_state = 'unknown'
             AND p.order_on IS NOT NULL
             AND p.order_on <= CURRENT_DATE - (
                 SELECT COALESCE(NULLIF(value,'')::int, 5)
                 FROM app_settings WHERE key = 'attention_quiet_days'
             ) THEN 'gone_quiet'
        WHEN p.delivery_state = 'unknown' THEN 'still_early'
        ELSE NULL
    END AS attention_group
FROM parcels p
WHERE p.warehouse_received = FALSE
  AND p.attention_state IS NULL
  AND p.delivery_state IN ('not_delivered','unknown');

NOTIFY pgrst, 'reload schema';

-- Check — nothing should have moved
SELECT
    (SELECT COUNT(*) FROM parcels)           AS parcels,
    (SELECT COUNT(*) FROM box_items)         AS box_lines,
    (SELECT COUNT(*) FROM scan_log)          AS scans,
    (SELECT COUNT(*) FROM attention_parcels) AS needing_attention;
