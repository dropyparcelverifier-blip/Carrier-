-- ═══════════════════════════════════════════════════════════════════════
--  DELIVERY DATE + ORDER IDS
--
--  ADDS    : two columns on parcels, two views
--  DELETES : nothing. Every parcel, item, box, box line and scan stays
--            exactly where it is.
--
--  Safe to run more than once.
--
--  After running this, re-upload your shipment report once. The delivery
--  dates were never captured before, so they are blank until a report
--  fills them in. Re-uploading is safe — records already on file keep
--  their scan status.
-- ═══════════════════════════════════════════════════════════════════════

-- Amazon's expected delivery date. Checked against 3,096 delivered rows in
-- the real report: 3,095 had already passed, so for a parcel marked
-- delivered this is the date it arrived, not a guess about the future.
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS expected_delivery TEXT;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS delivery_on       DATE;

CREATE INDEX IF NOT EXISTS idx_parcels_delivery_on        ON parcels(delivery_on);
CREATE INDEX IF NOT EXISTS idx_parcels_stream_delivery    ON parcels(stream, delivery_on);


-- ───────────────────────────────────────────────────────────────────────
--  Cohorts by the day a parcel arrived, rather than the day it was ordered
--
--  The order calendar answers "what did we buy that day". This one answers
--  "what turned up that day", which is the question the warehouse asks.
-- ───────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS delivery_day_cohorts;
CREATE VIEW delivery_day_cohorts AS
SELECT
    delivery_on                                                 AS day,
    stream,
    COUNT(*)                                                    AS total,
    COUNT(*) FILTER (WHERE delivery_state = 'delivered')         AS delivered,
    COUNT(*) FILTER (WHERE delivery_state = 'delivered'
                       AND warehouse_received)                   AS scanned,
    COUNT(*) FILTER (WHERE delivery_state = 'delivered'
                       AND NOT warehouse_received
                       AND attention_state IS NULL)              AS missing,
    COUNT(*) FILTER (WHERE delivery_state = 'in_transit')        AS in_transit,
    COUNT(*) FILTER (WHERE delivery_state = 'not_delivered')     AS not_delivered
FROM parcels
WHERE delivery_on IS NOT NULL
GROUP BY delivery_on, stream;


-- BM counts items rather than parcels, because a BM box holds item lines
DROP VIEW IF EXISTS bm_delivery_days;
CREATE VIEW bm_delivery_days AS
SELECT
    p.delivery_on                                     AS day,
    COUNT(DISTINCT p.tracking_number)                 AS parcels,
    COALESCE(SUM(pi.quantity), 0)                     AS units,
    COALESCE(SUM(pi.qty_boxed), 0)                    AS boxed,
    COUNT(DISTINCT p.tracking_number) FILTER
        (WHERE pi.settled_at IS NOT NULL)             AS sent_before
FROM parcels p
LEFT JOIN parcel_items pi ON pi.tracking_number = p.tracking_number
WHERE p.stream = 'bm' AND p.delivery_on IS NOT NULL
GROUP BY p.delivery_on;


-- ───────────────────────────────────────────────────────────────────────
--  Order IDs on the BM manifest, so an admin can open the order on Amazon
-- ───────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS bm_days;
DROP VIEW IF EXISTS bm_totals;
DROP VIEW IF EXISTS bm_parcel_state;
CREATE VIEW bm_parcel_state AS
SELECT
    p.tracking_number, p.po_number, p.order_ids, p.carrier,
    p.order_date, p.order_on, p.shipment_date, p.delivery_on, p.delivery_state,
    COUNT(pi.id)                                      AS lines,
    COALESCE(SUM(pi.quantity), 0)                     AS units,
    COALESCE(SUM(pi.qty_boxed), 0)                    AS units_boxed,
    COUNT(*) FILTER (WHERE pi.settled_at IS NOT NULL) AS lines_settled,
    CASE
        WHEN COUNT(*) FILTER (WHERE pi.settled_at IS NOT NULL) = COUNT(pi.id)
             AND COUNT(pi.id) > 0                        THEN 'sent_before'
        WHEN COALESCE(SUM(pi.qty_boxed),0) = 0           THEN 'waiting'
        WHEN COALESCE(SUM(pi.qty_boxed),0) >= COALESCE(SUM(pi.quantity),0)
                                                         THEN 'boxed'
        ELSE 'part_boxed'
    END AS state
FROM parcels p
LEFT JOIN parcel_items pi ON pi.tracking_number = p.tracking_number
WHERE p.stream = 'bm'
GROUP BY p.tracking_number, p.po_number, p.order_ids, p.carrier,
         p.order_date, p.order_on, p.shipment_date, p.delivery_on, p.delivery_state;


-- rebuilt because they read bm_parcel_state
CREATE VIEW bm_days AS
SELECT
    order_on                                            AS day,
    COUNT(*)                                            AS parcels,
    COALESCE(SUM(units), 0)                             AS units,
    COALESCE(SUM(units_boxed), 0)                       AS boxed,
    COUNT(*) FILTER (WHERE state = 'sent_before')       AS sent_before,
    COUNT(*) FILTER (WHERE state = 'waiting')           AS waiting,
    COUNT(*) FILTER (WHERE state = 'part_boxed')        AS part_boxed,
    COUNT(*) FILTER (WHERE state = 'boxed')             AS boxed_parcels
FROM bm_parcel_state
WHERE order_on IS NOT NULL
GROUP BY order_on;

CREATE VIEW bm_totals AS
SELECT
    COUNT(*)                                      AS parcels,
    COALESCE(SUM(units), 0)                       AS units,
    COALESCE(SUM(units_boxed), 0)                 AS boxed,
    COUNT(*) FILTER (WHERE state = 'sent_before') AS sent_before_parcels,
    COALESCE(SUM(units) FILTER (WHERE state = 'sent_before'), 0) AS sent_before_units
FROM bm_parcel_state;


NOTIFY pgrst, 'reload schema';


-- ───────────────────────────────────────────────────────────────────────
--  Check — your counts should be unchanged, and delivery dates will read
--  0 until you re-upload a report
-- ───────────────────────────────────────────────────────────────────────
SELECT
    (SELECT COUNT(*) FROM parcels)                                AS parcels,
    (SELECT COUNT(*) FROM parcel_items)                           AS items,
    (SELECT COUNT(*) FROM boxes)                                  AS boxes,
    (SELECT COUNT(*) FROM box_items)                              AS box_lines,
    (SELECT COUNT(*) FROM scan_log)                               AS scans,
    (SELECT COUNT(*) FROM parcels WHERE delivery_on IS NOT NULL)  AS with_delivery_date;
