-- ═══════════════════════════════════════════════════════════════════════
--  DROPY SCAN — MASTER UPDATE
--
--  One file. Run it on your live database and everything is current.
--
--  ADDS    : columns, indexes, views, functions
--  DROPS   : views only — they are rebuilt in the same run
--  DELETES : nothing. Every parcel, item, box, box line and scan stays
--            exactly where it is.
--
--  Safe to run more than once. If part of it has already been applied,
--  the rest still lands and nothing is duplicated.
--
--  Pair this with the matching dropy-scan.zip. Run the SQL first.
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ═══════════════════════════════════════════════════════════════════════
--  1 · VIEWS COME DOWN FIRST
--
--  A view built on SELECT p.* depends on every column of its table, so a
--  column cannot be added or replaced while it exists. Everything is
--  rebuilt at the end naming its columns, which stops this recurring.
-- ═══════════════════════════════════════════════════════════════════════
-- Dependants before what they depend on: bm_available reads last_weight,
-- and weight_map_summary reads weight_map. Dropping a view that something
-- else is built on fails, so the order here is not arbitrary.
DROP VIEW IF EXISTS bm_available;
DROP VIEW IF EXISTS bm_cohorts;
DROP VIEW IF EXISTS bm_splits;
DROP VIEW IF EXISTS bm_days;
DROP VIEW IF EXISTS bm_totals;
DROP VIEW IF EXISTS bm_parcel_state;
DROP VIEW IF EXISTS weight_map_summary;
DROP VIEW IF EXISTS weight_map;
DROP VIEW IF EXISTS last_weight;
DROP VIEW IF EXISTS delivery_cohorts;
DROP VIEW IF EXISTS transit_cohorts;
DROP VIEW IF EXISTS undated_deliveries;
DROP VIEW IF EXISTS attention_parcels;
DROP VIEW IF EXISTS unmatched_scans;
DROP VIEW IF EXISTS upload_days;
DROP VIEW IF EXISTS box_summary;
DROP VIEW IF EXISTS box_days;
DROP VIEW IF EXISTS discrepancies;
DROP VIEW IF EXISTS parcel_turnaround;


-- ═══════════════════════════════════════════════════════════════════════
--  2 · COLUMNS
-- ═══════════════════════════════════════════════════════════════════════

-- ── Which warehouse a parcel is headed to ──
-- Address is the only reliable signal. The PO prefix is not: 584 of
-- Bombino's parcels carry a Dropy- PO.
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS stream TEXT NOT NULL DEFAULT 'dropy';
ALTER TABLE parcels DROP CONSTRAINT IF EXISTS parcels_stream_check;
ALTER TABLE parcels ADD CONSTRAINT parcels_stream_check CHECK (stream IN ('dropy','bm'));

ALTER TABLE boxes ADD COLUMN IF NOT EXISTS stream TEXT NOT NULL DEFAULT 'dropy';
ALTER TABLE boxes DROP CONSTRAINT IF EXISTS boxes_stream_check;
ALTER TABLE boxes ADD CONSTRAINT boxes_stream_check CHECK (stream IN ('dropy','bm'));

-- ── Order date, so cohorts group by the day you placed the order ──
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS order_date TEXT;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS order_on   DATE;

-- ── Delivery date, recorded only when we watch a parcel change between
--    two uploads. Amazon's export carries none, so this stays null rather
--    than guessing from the shipment date. ──
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS delivered_on        DATE;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS delivered_on_source TEXT;
ALTER TABLE parcels DROP CONSTRAINT IF EXISTS parcels_delivered_source_check;
ALTER TABLE parcels ADD CONSTRAINT parcels_delivered_source_check
    CHECK (delivered_on_source IS NULL OR delivered_on_source IN ('observed','manual'));

-- ── Punctuation-insensitive search: "Dropy 1856" finds "Dropy-1856" ──
ALTER TABLE parcels DROP COLUMN IF EXISTS search_key;
ALTER TABLE parcels ADD COLUMN search_key TEXT
    GENERATED ALWAYS AS (
        lower(regexp_replace(
            coalesce(tracking_number,'') || coalesce(po_number,''),
            '[^a-zA-Z0-9]', '', 'g'))
    ) STORED;

ALTER TABLE parcel_items DROP COLUMN IF EXISTS search_key;
ALTER TABLE parcel_items ADD COLUMN search_key TEXT
    GENERATED ALWAYS AS (
        lower(regexp_replace(
            coalesce(order_id,'') || coalesce(po_number,'') || coalesce(asin,''),
            '[^a-zA-Z0-9]', '', 'g'))
    ) STORED;

-- ── Why a packer entered a different quantity. Free text, because
--    "one arrived crushed" is more use than "damaged". ──
ALTER TABLE box_items ADD COLUMN IF NOT EXISTS qty_reason TEXT DEFAULT '';

-- ── Item-level boxing, for BM only.
--    Abhi ships whole parcels, so a box claims the parcel. Bombino opens
--    the parcels and clubs the contents, so a box takes item lines — and a
--    line can be split across boxes. ──
ALTER TABLE parcel_items ADD COLUMN IF NOT EXISTS qty_boxed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE box_items    ADD COLUMN IF NOT EXISTS item_id   BIGINT;

-- ── Lines Bombino shipped by hand before this system existed. Marking
--    them settled keeps them out of the box builder without inventing a
--    box that never existed in here. ──
ALTER TABLE parcel_items ADD COLUMN IF NOT EXISTS settled_at   TIMESTAMPTZ;
ALTER TABLE parcel_items ADD COLUMN IF NOT EXISTS settled_by   TEXT DEFAULT '';
ALTER TABLE parcel_items ADD COLUMN IF NOT EXISTS settled_note TEXT DEFAULT '';

-- ── Dismissing a stray scan ──
ALTER TABLE scan_log ADD COLUMN IF NOT EXISTS dismissed    BOOLEAN DEFAULT FALSE;
ALTER TABLE scan_log ADD COLUMN IF NOT EXISTS dismissed_by TEXT DEFAULT '';
ALTER TABLE scan_log ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;


-- ═══════════════════════════════════════════════════════════════════════
--  3 · BACKFILL
-- ═══════════════════════════════════════════════════════════════════════

-- Everything already on file came in before Bombino was handled here
UPDATE parcels SET stream = 'dropy' WHERE stream IS NULL;
UPDATE boxes   SET stream = 'dropy' WHERE stream IS NULL;

-- Order date from the item rows, which already carry it per line
UPDATE parcels p
SET order_date = i.order_date,
    order_on   = to_date(i.order_date, 'MM/DD/YYYY')
FROM (
    SELECT DISTINCT ON (tracking_number) tracking_number, order_date
    FROM parcel_items
    WHERE order_date ~ '^\d{2}/\d{2}/\d{4}$'
    ORDER BY tracking_number, order_date
) i
WHERE p.tracking_number = i.tracking_number
  AND p.order_on IS NULL;

-- Anything the items could not supply falls back to the shipment date
UPDATE parcels
SET order_date = shipment_date, order_on = ship_date
WHERE order_on IS NULL AND ship_date IS NOT NULL;

-- Earlier versions guessed a delivery date from the shipment date. That is
-- a guess, and a bad one, so clear it. Observed dates are real — keep those.
UPDATE parcels
SET delivered_on = NULL, delivered_on_source = NULL
WHERE delivered_on_source = 'assumed';


-- ═══════════════════════════════════════════════════════════════════════
--  4 · INDEXES
-- ═══════════════════════════════════════════════════════════════════════
DROP INDEX IF EXISTS idx_parcels_search;
CREATE INDEX idx_parcels_search ON parcels USING gin (search_key gin_trgm_ops);
DROP INDEX IF EXISTS idx_items_search;
CREATE INDEX idx_items_search ON parcel_items USING gin (search_key gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_parcels_stream       ON parcels(stream);
CREATE INDEX IF NOT EXISTS idx_parcels_stream_order ON parcels(stream, order_on);
CREATE INDEX IF NOT EXISTS idx_parcels_order_on     ON parcels(order_on);
CREATE INDEX IF NOT EXISTS idx_parcels_delivered_on ON parcels(delivered_on);
CREATE INDEX IF NOT EXISTS idx_boxes_stream         ON boxes(stream);
CREATE INDEX IF NOT EXISTS idx_items_order          ON parcel_items(order_id);
CREATE INDEX IF NOT EXISTS idx_items_boxed          ON parcel_items(qty_boxed);
CREATE INDEX IF NOT EXISTS idx_items_settled        ON parcel_items(settled_at);
CREATE INDEX IF NOT EXISTS idx_boxitems_asin        ON box_items(asin);
CREATE INDEX IF NOT EXISTS idx_boxitems_asin_time   ON box_items(asin, packed_at DESC);
CREATE INDEX IF NOT EXISTS idx_boxitems_item        ON box_items(item_id);
CREATE INDEX IF NOT EXISTS idx_scan_action          ON scan_log(action, dismissed);
CREATE INDEX IF NOT EXISTS idx_scan_recent          ON scan_log(action, scanned_at DESC);


-- ═══════════════════════════════════════════════════════════════════════
--  5 · SETTINGS
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO app_settings (key, value)
VALUES ('attention_quiet_days', '5')
ON CONFLICT (key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════
--  6 · VIEWS
-- ═══════════════════════════════════════════════════════════════════════

-- What a product weighed last time it was packed. The last value, not an
-- average: a packer wants "it was 165 g last time", not a statistic.
CREATE VIEW last_weight AS
SELECT DISTINCT ON (asin)
    asin, weight_g AS last_g, packed_at AS last_at, box_id AS last_box
FROM box_items
WHERE weight_g IS NOT NULL AND asin <> ''
ORDER BY asin, packed_at DESC;


-- Abhi cohorts, by order date. A single receiving percentage over a growing
-- pile drifts toward a constant and says nothing; per day it is actionable.
CREATE VIEW delivery_cohorts AS
SELECT
    order_on                                                    AS day,
    COUNT(*)                                                    AS total,
    COUNT(*) FILTER (WHERE delivery_state = 'delivered')        AS delivered,
    COUNT(*) FILTER (WHERE delivery_state = 'delivered'
                       AND warehouse_received)                  AS scanned,
    COUNT(*) FILTER (WHERE delivery_state = 'delivered'
                       AND NOT warehouse_received
                       AND attention_state IS NULL)             AS missing,
    COUNT(*) FILTER (WHERE delivery_state = 'delivered'
                       AND NOT warehouse_received
                       AND attention_state IS NULL
                       AND order_on < CURRENT_DATE - 3)         AS delayed,
    COUNT(*) FILTER (WHERE delivery_state = 'in_transit')       AS in_transit,
    COUNT(*) FILTER (WHERE delivery_state = 'not_delivered')    AS not_delivered,
    COUNT(*) FILTER (WHERE attention_state IS NOT NULL)         AS settled
FROM parcels
WHERE order_on IS NOT NULL AND stream = 'dropy'
GROUP BY order_on;


-- Needs a decision. A parcel with no status is normal transit at first —
-- only silence past the threshold is worth chasing.
CREATE VIEW attention_parcels AS
SELECT
    p.tracking_number, p.carrier, p.po_number, p.item_count,
    p.order_date, p.order_on, p.shipment_date, p.ship_date,
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


-- Scanned, but matching no parcel on file. Clears itself when a later
-- report introduces the tracking number.
CREATE VIEW unmatched_scans AS
SELECT DISTINCT ON (s.tracking_number)
    s.tracking_number, s.scanned_at, s.scanned_by,
    (SELECT COUNT(*) FROM scan_log x
      WHERE x.tracking_number = s.tracking_number
        AND x.action = 'not_found') AS times_scanned
FROM scan_log s
LEFT JOIN parcels p ON p.tracking_number = s.tracking_number
WHERE s.action = 'not_found' AND s.dismissed = FALSE AND p.tracking_number IS NULL
ORDER BY s.tracking_number, s.scanned_at DESC;


-- Which days a report has covered — drives the coverage calendar
CREATE VIEW upload_days AS
SELECT DISTINCT d::date AS day
FROM uploads u
CROSS JOIN LATERAL generate_series(u.covers_from, u.covers_to, INTERVAL '1 day') d
WHERE u.covers_from IS NOT NULL AND u.covers_to IS NOT NULL;


-- Box totals. weight_g is per unit, so a line weighs qty × weight.
CREATE VIEW box_summary AS
SELECT
    b.box_id, b.packer_name, b.status, b.stream,
    b.filled_weight, b.empty_weight, b.net_weight,
    b.created_at, b.closed_at,
    COUNT(DISTINCT bi.tracking_number)            AS parcel_count,
    COALESCE(SUM(bi.qty_actual), 0)               AS item_count,
    COALESCE(SUM(bi.weight_g * bi.qty_actual), 0) AS items_weight_g,
    COALESCE(SUM(bi.item_total), 0)               AS declared_value
FROM boxes b
LEFT JOIN box_items bi ON bi.box_id = b.box_id
GROUP BY b.box_id;


-- Boxes bundled by the day they were closed — the unit the daily file covers
CREATE VIEW box_days AS
SELECT
    (closed_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
    stream,
    COUNT(*)                     AS boxes,
    SUM(COALESCE(net_weight, 0)) AS net_kg
FROM boxes
WHERE status = 'closed' AND closed_at IS NOT NULL
GROUP BY 1, 2;


-- Every weighing, kept as history rather than averaged away. An ASIN that
-- has weighed 180 g eleven times and 640 g once is telling you something.
CREATE VIEW weight_map AS
SELECT
    bi.asin, bi.title, bi.tracking_number, bi.po_number,
    pi.order_id, bi.box_id, bi.qty_actual,
    bi.weight_g                           AS weight_per_unit,
    ROUND(bi.weight_g * bi.qty_actual, 2) AS line_weight_g,
    bi.packed_by, bi.packed_at
FROM box_items bi
LEFT JOIN parcel_items pi
       ON pi.tracking_number = bi.tracking_number AND pi.asin = bi.asin
WHERE bi.weight_g IS NOT NULL AND bi.asin <> '';


CREATE VIEW weight_map_summary AS
SELECT
    asin, MAX(title) AS title, COUNT(*) AS times_weighed,
    ROUND(AVG(weight_per_unit), 2)        AS avg_g,
    MIN(weight_per_unit)                  AS min_g,
    MAX(weight_per_unit)                  AS max_g,
    ROUND(STDDEV_POP(weight_per_unit), 2) AS spread_g,
    MAX(packed_at)                        AS last_weighed
FROM weight_map
WHERE weight_per_unit IS NOT NULL
GROUP BY asin;


-- Where a box disagreed with the order
CREATE VIEW discrepancies AS
SELECT
    bi.box_id, bi.tracking_number, bi.po_number, bi.asin, bi.title,
    bi.qty_expected, bi.qty_actual,
    (bi.qty_actual - bi.qty_expected) AS delta,
    CASE
        WHEN bi.qty_actual = 0               THEN 'nothing in the parcel'
        WHEN bi.qty_actual < bi.qty_expected THEN 'short'
        ELSE 'extra'
    END AS kind,
    bi.unit_price,
    ROUND((bi.qty_actual - bi.qty_expected) * COALESCE(bi.unit_price,0), 2) AS value_delta,
    bi.packed_by, bi.packed_at, b.packer_name, b.status AS box_status
FROM box_items bi
JOIN boxes b ON b.box_id = bi.box_id
WHERE bi.qty_actual <> bi.qty_expected;


-- Received at Jamaica → boxed in India
CREATE VIEW parcel_turnaround AS
SELECT
    p.tracking_number, p.po_number, p.box_id,
    p.warehouse_received_at, p.boxed_at,
    EXTRACT(EPOCH FROM (p.boxed_at - p.warehouse_received_at)) / 86400 AS days_to_box,
    CASE
        WHEN p.boxed_at IS NOT NULL THEN 'boxed'
        WHEN p.warehouse_received_at IS NOT NULL THEN 'waiting'
        ELSE 'not received'
    END AS stage
FROM parcels p;


-- ── BM ──

-- What Bombino has waiting to be boxed: delivered, not fully boxed, and
-- not marked as handled before this system existed.
CREATE VIEW bm_available AS
SELECT
    pi.id AS item_id, pi.tracking_number, pi.asin, pi.title,
    pi.po_number, pi.order_id, pi.unit_price,
    pi.quantity                  AS qty_ordered,
    pi.qty_boxed,
    (pi.quantity - pi.qty_boxed) AS qty_left,
    p.order_date, p.order_on, p.shipment_date, p.delivery_state, p.carrier,
    lw.last_g
FROM parcel_items pi
JOIN parcels p ON p.tracking_number = pi.tracking_number
LEFT JOIN last_weight lw ON lw.asin = pi.asin
WHERE p.stream = 'bm'
  AND p.delivery_state = 'delivered'
  AND pi.quantity > pi.qty_boxed
  AND pi.settled_at IS NULL;


-- BM cohorts, measured in items rather than parcels, because a box holds items
CREATE VIEW bm_cohorts AS
SELECT
    p.order_on                                              AS day,
    COUNT(*)                                                AS lines,
    SUM(pi.quantity)                                        AS ordered,
    SUM(pi.qty_boxed)                                       AS boxed,
    SUM(pi.quantity - pi.qty_boxed) FILTER
        (WHERE p.delivery_state = 'delivered')              AS waiting,
    COUNT(*) FILTER (WHERE p.delivery_state <> 'delivered') AS not_delivered
FROM parcel_items pi
JOIN parcels p ON p.tracking_number = pi.tracking_number
WHERE p.stream = 'bm' AND p.order_on IS NOT NULL
GROUP BY p.order_on;


-- Where a split line ended up, so "12 pads went out as 8 + 4" is answerable
CREATE VIEW bm_splits AS
SELECT
    pi.id AS item_id, pi.asin, pi.title, pi.po_number, pi.tracking_number,
    pi.quantity                  AS qty_ordered,
    pi.qty_boxed,
    (pi.quantity - pi.qty_boxed) AS qty_left,
    bi.box_id, bi.qty_actual     AS qty_in_box,
    bi.weight_g, bi.packed_at, b.status AS box_status
FROM parcel_items pi
JOIN parcels p ON p.tracking_number = pi.tracking_number
LEFT JOIN box_items bi ON bi.item_id = pi.id
LEFT JOIN boxes b ON b.box_id = bi.box_id
WHERE p.stream = 'bm' AND pi.qty_boxed > 0;


-- What a BM parcel's lines are doing, for the manifest
CREATE VIEW bm_parcel_state AS
SELECT
    p.tracking_number, p.po_number, p.carrier,
    p.order_date, p.order_on, p.shipment_date, p.delivery_state,
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
GROUP BY p.tracking_number, p.po_number, p.carrier,
         p.order_date, p.order_on, p.shipment_date, p.delivery_state;


-- Counting per day in the database, not in the browser. Adding up every
-- parcel client-side silently stopped at Supabase's 1,000-row response cap,
-- so a stream with more than a thousand parcels under-reported itself.
DROP VIEW IF EXISTS bm_days;
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


-- Whole-stream totals, so the four figures at the top are never capped
DROP VIEW IF EXISTS bm_totals;
CREATE VIEW bm_totals AS
SELECT
    COUNT(*)                                      AS parcels,
    COALESCE(SUM(units), 0)                       AS units,
    COALESCE(SUM(units_boxed), 0)                 AS boxed,
    COUNT(*) FILTER (WHERE state = 'sent_before') AS sent_before_parcels,
    COALESCE(SUM(units) FILTER (WHERE state = 'sent_before'), 0) AS sent_before_units
FROM bm_parcel_state;




-- ═══════════════════════════════════════════════════════════════════════
--  7 · FUNCTIONS
--
--  search_path includes `extensions` because Supabase installs pgcrypto
--  there — pinning to public alone hides gen_salt and crypt.
-- ═══════════════════════════════════════════════════════════════════════

-- A parcel scanned before its report arrived is already on the shelf. Mark
-- it received, dated to the scan rather than the upload.
CREATE OR REPLACE FUNCTION reconcile_unmatched_scans()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE fixed INT := 0;
BEGIN
    WITH firsts AS (
        SELECT s.tracking_number,
               MIN(s.scanned_at) AS first_seen,
               (ARRAY_AGG(s.scanned_by ORDER BY s.scanned_at))[1] AS by_whom
        FROM scan_log s
        JOIN parcels p ON p.tracking_number = s.tracking_number
        WHERE s.action = 'not_found' AND p.warehouse_received = FALSE
        GROUP BY s.tracking_number
    )
    UPDATE parcels p
    SET warehouse_received = TRUE, warehouse_received_at = f.first_seen,
        warehouse_received_by = f.by_whom, status = 'delivered', updated_at = NOW()
    FROM firsts f
    WHERE p.tracking_number = f.tracking_number AND p.warehouse_received = FALSE;

    GET DIAGNOSTICS fixed = ROW_COUNT;

    UPDATE scan_log s SET action = 'received'
    FROM parcels p
    WHERE p.tracking_number = s.tracking_number
      AND s.action = 'not_found' AND p.warehouse_received = TRUE;

    RETURN fixed;
END;
$fn$;


-- ── BM: adding to a box ──
--
-- Bombino routinely splits a line — 8 of 12 in one box, 4 in the next. Two
-- people packing at once could each pass their own check and between them
-- box more than arrived. Doing the check and the claim in one statement
-- makes that impossible: the second write finds nothing to update.
CREATE OR REPLACE FUNCTION bm_box_add(
    p_item_id BIGINT, p_box_id TEXT, p_qty INTEGER,
    p_weight NUMERIC, p_by TEXT, p_reason TEXT DEFAULT ''
)
RETURNS TABLE (ok BOOLEAN, reason TEXT, qty_left INTEGER)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE it RECORD; boxrow RECORD; claimed INTEGER;
BEGIN
    IF p_qty IS NULL OR p_qty <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Quantity must be above zero', 0; RETURN;
    END IF;
    IF p_weight IS NULL OR p_weight <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Weight must be above zero', 0; RETURN;
    END IF;

    SELECT * INTO boxrow FROM boxes WHERE box_id = p_box_id;
    IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'No such box', 0; RETURN; END IF;
    IF boxrow.status <> 'open' THEN
        RETURN QUERY SELECT FALSE, 'That box is closed', 0; RETURN;
    END IF;

    SELECT pi.*, p.stream INTO it
    FROM parcel_items pi JOIN parcels p ON p.tracking_number = pi.tracking_number
    WHERE pi.id = p_item_id;

    IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'No such item', 0; RETURN; END IF;
    IF it.stream <> 'bm' THEN
        RETURN QUERY SELECT FALSE, 'That item is not a BM item', 0; RETURN;
    END IF;

    UPDATE parcel_items
    SET qty_boxed = qty_boxed + p_qty
    WHERE id = p_item_id AND quantity - qty_boxed >= p_qty;

    GET DIAGNOSTICS claimed = ROW_COUNT;

    IF claimed = 0 THEN
        SELECT (quantity - qty_boxed) INTO claimed FROM parcel_items WHERE id = p_item_id;
        RETURN QUERY SELECT FALSE, 'Only ' || claimed || ' left on that line', claimed;
        RETURN;
    END IF;

    INSERT INTO box_items (box_id, tracking_number, asin, title, po_number,
                           qty_expected, qty_actual, qty_reason, weight_g,
                           unit_price, item_total, item_id, packed_by, packed_at)
    VALUES (p_box_id, it.tracking_number, it.asin, it.title, it.po_number,
            it.quantity, p_qty, COALESCE(p_reason,''), p_weight,
            it.unit_price, ROUND(COALESCE(it.unit_price,0) * p_qty, 2),
            p_item_id, p_by, NOW())
    ON CONFLICT (box_id, tracking_number, asin) DO UPDATE
        SET qty_actual = box_items.qty_actual + EXCLUDED.qty_actual,
            item_total = box_items.item_total + EXCLUDED.item_total,
            weight_g   = EXCLUDED.weight_g;

    SELECT (quantity - qty_boxed) INTO claimed FROM parcel_items WHERE id = p_item_id;
    RETURN QUERY SELECT TRUE, 'added'::TEXT, claimed;
END;
$fn$;


-- Taking a line back out returns the quantity to the pool
CREATE OR REPLACE FUNCTION bm_box_remove(p_box_id TEXT, p_row_id BIGINT)
RETURNS TABLE (ok BOOLEAN, reason TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE r RECORD; st TEXT;
BEGIN
    SELECT status INTO st FROM boxes WHERE box_id = p_box_id;
    IF st IS NULL THEN RETURN QUERY SELECT FALSE, 'No such box'; RETURN; END IF;
    IF st <> 'open' THEN RETURN QUERY SELECT FALSE, 'That box is closed'; RETURN; END IF;

    SELECT * INTO r FROM box_items WHERE id = p_row_id AND box_id = p_box_id;
    IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 'Not in this box'; RETURN; END IF;

    IF r.item_id IS NOT NULL THEN
        UPDATE parcel_items
        SET qty_boxed = GREATEST(0, qty_boxed - r.qty_actual)
        WHERE id = r.item_id;
    END IF;

    DELETE FROM box_items WHERE id = p_row_id;
    RETURN QUERY SELECT TRUE, 'removed'::TEXT;
END;
$fn$;


-- Deleting an open BM box hands everything in it back
CREATE OR REPLACE FUNCTION bm_box_delete(p_box_id TEXT)
RETURNS TABLE (ok BOOLEAN, reason TEXT, released INTEGER)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE st TEXT; n INTEGER := 0;
BEGIN
    SELECT status INTO st FROM boxes WHERE box_id = p_box_id;
    IF st IS NULL THEN RETURN QUERY SELECT FALSE, 'No such box', 0; RETURN; END IF;
    IF st <> 'open' THEN
        RETURN QUERY SELECT FALSE, 'A closed box cannot be deleted', 0; RETURN;
    END IF;

    UPDATE parcel_items pi
    SET qty_boxed = GREATEST(0, pi.qty_boxed - bi.qty_actual)
    FROM box_items bi
    WHERE bi.box_id = p_box_id AND bi.item_id = pi.id;

    GET DIAGNOSTICS n = ROW_COUNT;

    DELETE FROM box_items WHERE box_id = p_box_id;
    DELETE FROM boxes WHERE box_id = p_box_id AND status = 'open';

    RETURN QUERY SELECT TRUE, 'deleted'::TEXT, n;
END;
$fn$;


-- Months of stock Bombino shipped by hand before this existed. Marking it
-- settled keeps it out of the box builder without inventing a box.
CREATE OR REPLACE FUNCTION bm_mark_sent(
    p_tracking TEXT[], p_by TEXT, p_note TEXT DEFAULT 'sent before the system'
)
RETURNS TABLE (ok BOOLEAN, lines INTEGER, units INTEGER)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE n INTEGER := 0; u INTEGER := 0;
BEGIN
    WITH hit AS (
        UPDATE parcel_items pi
        SET settled_at = NOW(), settled_by = p_by, settled_note = p_note
        FROM parcels p
        WHERE p.tracking_number = pi.tracking_number
          AND p.stream = 'bm'
          AND pi.tracking_number = ANY(p_tracking)
          AND pi.settled_at IS NULL
          AND pi.qty_boxed = 0          -- never touch a line already in a box
        RETURNING pi.quantity
    )
    SELECT COUNT(*), COALESCE(SUM(quantity),0) INTO n, u FROM hit;
    RETURN QUERY SELECT TRUE, n, u;
END;
$fn$;


CREATE OR REPLACE FUNCTION bm_unmark_sent(p_tracking TEXT[])
RETURNS TABLE (ok BOOLEAN, lines INTEGER)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE n INTEGER := 0;
BEGIN
    WITH hit AS (
        UPDATE parcel_items pi
        SET settled_at = NULL, settled_by = '', settled_note = ''
        FROM parcels p
        WHERE p.tracking_number = pi.tracking_number
          AND p.stream = 'bm'
          AND pi.tracking_number = ANY(p_tracking)
          AND pi.settled_at IS NOT NULL
        RETURNING 1
    )
    SELECT COUNT(*) INTO n FROM hit;
    RETURN QUERY SELECT TRUE, n;
END;
$fn$;


-- PostgREST caches the table shape; without this the API keeps serving the
-- old column list and every new query fails.
NOTIFY pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════════
--  CHECK
--
--  Your parcels, boxes and box lines should read exactly what they did
--  before. bm_parcels stays 0 until you upload a report with the new app.
-- ═══════════════════════════════════════════════════════════════════════
SELECT
    (SELECT COUNT(*) FROM parcels WHERE stream = 'dropy') AS abhi_parcels,
    (SELECT COUNT(*) FROM parcels WHERE stream = 'bm')    AS bm_parcels,
    (SELECT COUNT(*) FROM parcel_items)                   AS item_lines,
    (SELECT COUNT(*) FROM boxes)                          AS boxes,
    (SELECT COUNT(*) FROM box_items)                      AS box_lines,
    (SELECT COUNT(*) FROM scan_log)                       AS scans,
    (SELECT COUNT(*) FROM parcels WHERE order_on IS NULL) AS missing_order_date;
