-- ═══════════════════════════════════════════════════════════════
--  DROPY SCAN — FIRST INSTALL ONLY
--
--  ⚠  THIS DELETES DATA. It drops and rebuilds parcels, items,
--     boxes, box contents, scans and upload history. Closed boxes
--     and everything the warehouse has scanned are lost.
--
--  Use this ONLY on a brand new, empty Supabase project.
--
--  ON A DATABASE THAT IS ALREADY IN USE, RUN catch_up.sql INSTEAD.
--  It adds whatever is missing and deletes nothing.
--
--  Kept either way: logins, packer names, settings.
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Trigram index support, so a partial search stays fast on a big manifest
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ═══════════════════════════════════════════════════════════════
--  1. CLEAR
--     Views first, then data tables. Config tables are left alone.
-- ═══════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS delivery_cohorts;
DROP VIEW IF EXISTS transit_cohorts;
DROP VIEW IF EXISTS undated_deliveries;
DROP VIEW IF EXISTS attention_parcels;
DROP VIEW IF EXISTS unmatched_scans;
DROP VIEW IF EXISTS upload_days;
DROP VIEW IF EXISTS box_summary;
DROP VIEW IF EXISTS last_weight;
DROP VIEW IF EXISTS box_days;
DROP VIEW IF EXISTS weight_map_summary;
DROP VIEW IF EXISTS weight_map;
DROP VIEW IF EXISTS discrepancies;
DROP VIEW IF EXISTS parcel_turnaround;

DROP TABLE IF EXISTS box_items    CASCADE;
DROP TABLE IF EXISTS parcel_items CASCADE;
DROP TABLE IF EXISTS scan_log     CASCADE;
DROP TABLE IF EXISTS boxes        CASCADE;
DROP TABLE IF EXISTS parcels      CASCADE;
DROP TABLE IF EXISTS uploads      CASCADE;


-- ═══════════════════════════════════════════════════════════════
--  2. PARCELS
--     One row per tracking number. The unit the warehouse handles.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE parcels (
    tracking_number       TEXT PRIMARY KEY,
    carrier               TEXT DEFAULT '',
    po_number             TEXT DEFAULT '',
    order_ids             JSONB DEFAULT '[]',
    item_count            INTEGER DEFAULT 1,
    shipping_address      TEXT DEFAULT '',

    -- Dates arrive as MM/DD/YYYY text. The text is kept for display,
    -- the DATE columns for sorting and grouping — string sorting would
    -- reverse itself at a year boundary.
    order_date            TEXT,
    order_on              DATE,
    shipment_date         TEXT,
    ship_date             DATE,

    -- What the carrier says. "Not delivered" is its own state: treating
    -- it as in-transit left failed deliveries sitting in the pile forever.
    delivery_status_raw   TEXT DEFAULT '',
    delivery_state        TEXT DEFAULT 'unknown'
                          CHECK (delivery_state IN ('delivered','not_delivered','in_transit','unknown')),
    amazon_delivered      BOOLEAN DEFAULT FALSE,
    amazon_delivered_date TEXT,

    -- Recorded only when we watch a parcel change between two uploads.
    -- Amazon's export carries no delivery date, so this stays null until
    -- then rather than guessing from the shipment date.
    delivered_on          DATE,
    delivered_on_source   TEXT CHECK (delivered_on_source IS NULL
                                      OR delivered_on_source IN ('observed','manual')),

    -- What the warehouse says
    warehouse_received    BOOLEAN DEFAULT FALSE,
    warehouse_received_at TIMESTAMPTZ,
    warehouse_received_by TEXT,

    -- India side
    box_id                TEXT,
    boxed_at              TIMESTAMPTZ,

    -- Admin decisions on problem parcels
    attention_state       TEXT CHECK (attention_state IS NULL
                                      OR attention_state IN ('cancelled','on_hold','resolved')),
    attention_note        TEXT DEFAULT '',
    attention_by          TEXT DEFAULT '',
    attention_at          TIMESTAMPTZ,

    status                TEXT DEFAULT 'shipped'
                          CHECK (status IN ('shipped','delivered','boxed')),
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Everything searchable, stripped to letters and digits and lowercased.
-- "Dropy 1856", "dropy-1856" and "DROPY1856" all reduce to the same string,
-- so punctuation never decides whether a search finds something.
ALTER TABLE parcels ADD COLUMN search_key TEXT
    GENERATED ALWAYS AS (
        lower(regexp_replace(
            coalesce(tracking_number,'') || coalesce(po_number,''),
            '[^a-zA-Z0-9]', '', 'g'))
    ) STORED;

CREATE INDEX idx_parcels_search ON parcels USING gin (search_key gin_trgm_ops);
CREATE INDEX idx_parcels_state     ON parcels(delivery_state);
CREATE INDEX idx_parcels_received  ON parcels(warehouse_received);
CREATE INDEX idx_parcels_order_on  ON parcels(order_on);
CREATE INDEX idx_parcels_ship_date ON parcels(ship_date);
CREATE INDEX idx_parcels_po        ON parcels(po_number);
CREATE INDEX idx_parcels_box       ON parcels(box_id);
CREATE INDEX idx_parcels_attention ON parcels(attention_state);


-- ═══════════════════════════════════════════════════════════════
--  3. PARCEL ITEMS
--     One row per line item. Box logs need descriptions and values,
--     which a parcel-level count cannot supply.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE parcel_items (
    id              BIGSERIAL PRIMARY KEY,
    tracking_number TEXT NOT NULL,
    order_id        TEXT DEFAULT '',
    po_number       TEXT DEFAULT '',
    asin            TEXT DEFAULT '',
    title           TEXT DEFAULT '',
    brand           TEXT DEFAULT '',
    manufacturer    TEXT DEFAULT '',
    part_number     TEXT DEFAULT '',
    condition       TEXT DEFAULT '',
    category        TEXT DEFAULT '',
    unspsc          TEXT DEFAULT '',
    seller_name     TEXT DEFAULT '',
    order_date      TEXT DEFAULT '',
    quantity        INTEGER DEFAULT 1,
    unit_price      NUMERIC(12,2),
    item_tax        NUMERIC(12,2),
    item_total      NUMERIC(12,2),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tracking_number, order_id, asin)
);

ALTER TABLE parcel_items ADD COLUMN search_key TEXT
    GENERATED ALWAYS AS (
        lower(regexp_replace(
            coalesce(order_id,'') || coalesce(po_number,'') || coalesce(asin,''),
            '[^a-zA-Z0-9]', '', 'g'))
    ) STORED;

CREATE INDEX idx_items_search   ON parcel_items USING gin (search_key gin_trgm_ops);
CREATE INDEX idx_items_tracking ON parcel_items(tracking_number);
CREATE INDEX idx_items_asin     ON parcel_items(asin);
CREATE INDEX idx_items_po       ON parcel_items(po_number);
CREATE INDEX idx_items_order    ON parcel_items(order_id);


-- ═══════════════════════════════════════════════════════════════
--  4. BOXES
--     Weighed full on arrival, empty once unpacked. Net is derived
--     so the two can never disagree.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE boxes (
    box_id        TEXT PRIMARY KEY,
    packer_name   TEXT DEFAULT '',
    filled_weight NUMERIC(10,3),
    empty_weight  NUMERIC(10,3),
    net_weight    NUMERIC(10,3) GENERATED ALWAYS AS
                  (COALESCE(filled_weight,0) - COALESCE(empty_weight,0)) STORED,
    length_cm     NUMERIC(10,2),
    width_cm      NUMERIC(10,2),
    height_cm     NUMERIC(10,2),
    photo_urls    JSONB DEFAULT '[]',
    notes         TEXT DEFAULT '',
    status        TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
    created_by    TEXT DEFAULT '',
    opened_by     TEXT DEFAULT '',
    closed_by     TEXT DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    closed_at     TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_boxes_status ON boxes(status);
CREATE INDEX idx_boxes_packer ON boxes(packer_name);

ALTER TABLE parcels
    ADD CONSTRAINT parcels_box_fk FOREIGN KEY (box_id)
    REFERENCES boxes(box_id) ON DELETE SET NULL;


-- ═══════════════════════════════════════════════════════════════
--  5. BOX CONTENTS
--     What the packer actually found and weighed, against what the
--     report said to expect.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE box_items (
    id              BIGSERIAL PRIMARY KEY,
    box_id          TEXT NOT NULL REFERENCES boxes(box_id) ON DELETE CASCADE,
    tracking_number TEXT NOT NULL,
    asin            TEXT DEFAULT '',
    title           TEXT DEFAULT '',
    po_number       TEXT DEFAULT '',
    qty_expected    INTEGER DEFAULT 1,
    qty_actual      INTEGER DEFAULT 1,
    weight_g        NUMERIC(10,2),
    unit_price      NUMERIC(12,2),
    item_total      NUMERIC(12,2),
    qty_reason      TEXT DEFAULT '',
    packed_by       TEXT DEFAULT '',
    packed_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (box_id, tracking_number, asin)
);

CREATE INDEX idx_boxitems_box      ON box_items(box_id);
CREATE INDEX idx_boxitems_tracking ON box_items(tracking_number);
CREATE INDEX idx_boxitems_asin     ON box_items(asin);
CREATE INDEX idx_boxitems_asin_time ON box_items(asin, packed_at DESC);


-- ═══════════════════════════════════════════════════════════════
--  6. SCAN LOG
--     Every scan, including ones that matched nothing — that is
--     proof a person held a parcel we have no record of.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE scan_log (
    id              BIGSERIAL PRIMARY KEY,
    tracking_number TEXT NOT NULL,
    scanned_at      TIMESTAMPTZ DEFAULT NOW(),
    scanned_by      TEXT DEFAULT '',
    action          TEXT DEFAULT 'received'
                    CHECK (action IN ('received','not_found','duplicate')),
    dismissed       BOOLEAN DEFAULT FALSE,
    dismissed_by    TEXT DEFAULT '',
    dismissed_at    TIMESTAMPTZ
);

CREATE INDEX idx_scan_tracking ON scan_log(tracking_number);
CREATE INDEX idx_scan_time     ON scan_log(scanned_at DESC);
CREATE INDEX idx_scan_action   ON scan_log(action, dismissed);
CREATE INDEX idx_scan_recent   ON scan_log(action, scanned_at DESC);


-- ═══════════════════════════════════════════════════════════════
--  7. UPLOAD HISTORY
--     Records the span each report covered, which drives the
--     coverage calendar.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE uploads (
    id              BIGSERIAL PRIMARY KEY,
    filename        TEXT NOT NULL,
    uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by     TEXT DEFAULT 'admin',
    parcels_added   INTEGER DEFAULT 0,
    parcels_updated INTEGER DEFAULT 0,
    items_written   INTEGER DEFAULT 0,
    covers_from     DATE,
    covers_to       DATE
);


-- ═══════════════════════════════════════════════════════════════
--  8. CONFIG — created only if absent, so logins and packer
--     names survive a re-run.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app_users (
    username     TEXT PRIMARY KEY,
    pin_hash     TEXT NOT NULL,
    role         TEXT NOT NULL CHECK (role IN ('cargo','packer','admin')),
    display_name TEXT DEFAULT '',
    active       BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    role       TEXT DEFAULT 'packer',
    active     BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_attempts (
    id       BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    ok       BOOLEAN NOT NULL,
    at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts ON auth_attempts(username, at DESC);

INSERT INTO app_settings (key, value)
VALUES ('attention_quiet_days', '5')
ON CONFLICT (key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
--  9. AUTH
--     PINs are compared inside the database, so no hash ever
--     reaches the application.
--
--     search_path includes `extensions` because Supabase installs
--     pgcrypto there — pinning to public alone hides gen_salt.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_user_pin(p_username TEXT, p_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF p_pin !~ '^\d{4}$' THEN RETURN 'PIN must be exactly 4 digits'; END IF;

    UPDATE app_users SET pin_hash = crypt(p_pin, gen_salt('bf', 10))
    WHERE lower(username) = lower(p_username);

    IF NOT FOUND THEN RETURN 'No such user'; END IF;
    RETURN 'PIN updated for ' || p_username;
END;
$$;


CREATE OR REPLACE FUNCTION add_user(
    p_username TEXT, p_pin TEXT, p_role TEXT, p_display TEXT DEFAULT ''
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF p_pin !~ '^\d{4}$' THEN RETURN 'PIN must be exactly 4 digits'; END IF;
    IF p_role NOT IN ('cargo','packer','admin') THEN
        RETURN 'Role must be cargo, packer or admin';
    END IF;

    INSERT INTO app_users (username, pin_hash, role, display_name, active)
    VALUES (lower(p_username), crypt(p_pin, gen_salt('bf', 10)), p_role,
            COALESCE(NULLIF(p_display,''), p_username), TRUE)
    ON CONFLICT (username) DO UPDATE
        SET pin_hash = EXCLUDED.pin_hash,
            role = EXCLUDED.role,
            display_name = EXCLUDED.display_name,
            active = TRUE;

    RETURN 'User ' || lower(p_username) || ' ready';
END;
$$;


CREATE OR REPLACE FUNCTION verify_login(p_username TEXT, p_pin TEXT)
RETURNS TABLE (username TEXT, role TEXT, display_name TEXT, locked BOOLEAN, retry_after INT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    u          RECORD;
    recent_bad INT;
BEGIN
    -- A 4-digit PIN is 10,000 guesses; throttle before that matters
    SELECT COUNT(*) INTO recent_bad
    FROM auth_attempts a
    WHERE lower(a.username) = lower(p_username)
      AND a.ok = FALSE
      AND a.at > NOW() - INTERVAL '15 minutes';

    IF recent_bad >= 10 THEN
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, TRUE, 15;
        RETURN;
    END IF;

    SELECT au.username, au.role, au.display_name INTO u
    FROM app_users au
    WHERE lower(au.username) = lower(p_username)
      AND au.active = TRUE
      AND au.pin_hash = crypt(p_pin, au.pin_hash);

    IF u.username IS NULL THEN
        INSERT INTO auth_attempts (username, ok) VALUES (lower(p_username), FALSE);
        RETURN;
    END IF;

    INSERT INTO auth_attempts (username, ok) VALUES (lower(p_username), TRUE);
    DELETE FROM auth_attempts
    WHERE lower(auth_attempts.username) = lower(p_username) AND ok = FALSE;

    RETURN QUERY SELECT u.username, u.role, u.display_name, FALSE, 0;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
--  10. BACK-DATING
--      A parcel scanned before its report arrived is already on the
--      shelf. Mark it received, dated to the scan rather than the
--      upload, so the timings stay honest.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION reconcile_unmatched_scans()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
    SET warehouse_received    = TRUE,
        warehouse_received_at = f.first_seen,
        warehouse_received_by = f.by_whom,
        status                = 'delivered',
        updated_at            = NOW()
    FROM firsts f
    WHERE p.tracking_number = f.tracking_number
      AND p.warehouse_received = FALSE;

    GET DIAGNOSTICS fixed = ROW_COUNT;

    UPDATE scan_log s SET action = 'received'
    FROM parcels p
    WHERE p.tracking_number = s.tracking_number
      AND s.action = 'not_found'
      AND p.warehouse_received = TRUE;

    RETURN fixed;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
--  11. VIEWS
-- ═══════════════════════════════════════════════════════════════

-- Cohorts by order date. A single receiving percentage over a growing
-- pile drifts toward a constant and says nothing; per-day it is
-- actionable — of what was ordered on the 3rd, what is still missing?
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
WHERE order_on IS NOT NULL
GROUP BY order_on;


-- Needs a decision. A parcel with no status is normal transit at
-- first — only silence past the threshold is worth chasing, or the
-- flagged list buries itself.
-- Columns are named rather than using p.*, because a view built on p.*
-- depends on every column and blocks any column from being replaced.
CREATE VIEW attention_parcels AS
SELECT
    p.tracking_number,
    p.carrier,
    p.po_number,
    p.item_count,
    p.order_date,
    p.order_on,
    p.shipment_date,
    p.ship_date,
    p.delivery_state,
    p.delivery_status_raw,
    p.warehouse_received,
    p.attention_state,
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


-- Scanned, but matching no parcel on file. Clears itself when a
-- later report introduces the tracking number.
CREATE VIEW unmatched_scans AS
SELECT DISTINCT ON (s.tracking_number)
    s.tracking_number,
    s.scanned_at,
    s.scanned_by,
    (SELECT COUNT(*) FROM scan_log x
      WHERE x.tracking_number = s.tracking_number
        AND x.action = 'not_found') AS times_scanned
FROM scan_log s
LEFT JOIN parcels p ON p.tracking_number = s.tracking_number
WHERE s.action = 'not_found'
  AND s.dismissed = FALSE
  AND p.tracking_number IS NULL
ORDER BY s.tracking_number, s.scanned_at DESC;


-- Which days a report has covered — drives the coverage calendar
CREATE VIEW upload_days AS
SELECT DISTINCT d::date AS day
FROM uploads u
CROSS JOIN LATERAL generate_series(u.covers_from, u.covers_to, INTERVAL '1 day') d
WHERE u.covers_from IS NOT NULL AND u.covers_to IS NOT NULL;


-- What a product weighed the last time it was packed
CREATE VIEW last_weight AS
SELECT DISTINCT ON (asin)
    asin, weight_g AS last_g, packed_at AS last_at, box_id AS last_box
FROM box_items
WHERE weight_g IS NOT NULL AND asin <> ''
ORDER BY asin, packed_at DESC;


-- Box totals
CREATE VIEW box_summary AS
SELECT
    b.box_id, b.packer_name, b.status,
    b.filled_weight, b.empty_weight, b.net_weight,
    b.created_at, b.closed_at,
    COUNT(DISTINCT bi.tracking_number)  AS parcel_count,
    COALESCE(SUM(bi.qty_actual), 0)     AS item_count,
    -- weight_g is per unit, so a line weighs qty × weight
    COALESCE(SUM(bi.weight_g * bi.qty_actual), 0) AS items_weight_g,
    COALESCE(SUM(bi.item_total), 0)     AS declared_value
FROM boxes b
LEFT JOIN box_items bi ON bi.box_id = b.box_id
GROUP BY b.box_id;



-- Weight map. Every weighing of an ASIN, kept as history rather than an
-- average — a product that has weighed 180g eleven times and 640g once is
-- telling you something an average would hide.
CREATE VIEW weight_map AS
SELECT
    bi.asin,
    bi.title,
    bi.tracking_number,
    bi.po_number,
    pi.order_id,
    bi.box_id,
    bi.qty_actual,
    -- weight_g is the weight of ONE unit, as the packer is asked to enter it.
    -- The line total is therefore qty × weight, not a division.
    bi.weight_g                                  AS weight_per_unit,
    ROUND(bi.weight_g * bi.qty_actual, 2)        AS line_weight_g,
    bi.packed_by,
    bi.packed_at
FROM box_items bi
LEFT JOIN parcel_items pi
       ON pi.tracking_number = bi.tracking_number
      AND pi.asin = bi.asin
WHERE bi.weight_g IS NOT NULL
  AND bi.asin <> '';


-- Per-ASIN summary, used for the packing hint and for spotting outliers
CREATE VIEW weight_map_summary AS
SELECT
    asin,
    MAX(title)                                   AS title,
    COUNT(*)                                     AS times_weighed,
    ROUND(AVG(weight_per_unit), 2)               AS avg_g,
    MIN(weight_per_unit)                         AS min_g,
    MAX(weight_per_unit)                         AS max_g,
    ROUND(STDDEV_POP(weight_per_unit), 2)        AS spread_g,
    MAX(packed_at)                               AS last_weighed
FROM weight_map
WHERE weight_per_unit IS NOT NULL
GROUP BY asin;


-- Where the box disagreed with the report. The data was always captured;
-- nothing read it until now.
CREATE VIEW discrepancies AS
SELECT
    bi.box_id,
    bi.tracking_number,
    bi.po_number,
    bi.asin,
    bi.title,
    bi.qty_expected,
    bi.qty_actual,
    (bi.qty_actual - bi.qty_expected) AS delta,
    CASE
        WHEN bi.qty_actual = 0                    THEN 'nothing in the parcel'
        WHEN bi.qty_actual < bi.qty_expected      THEN 'short'
        ELSE 'extra'
    END AS kind,
    bi.unit_price,
    ROUND((bi.qty_actual - bi.qty_expected) * COALESCE(bi.unit_price,0), 2) AS value_delta,
    bi.packed_by,
    bi.packed_at,
    b.packer_name,
    b.status AS box_status
FROM box_items bi
JOIN boxes b ON b.box_id = bi.box_id
WHERE bi.qty_actual <> bi.qty_expected;


-- Boxes grouped by the day they were closed, for the daily export
CREATE VIEW box_days AS
SELECT
    (closed_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
    COUNT(*)                                      AS boxes,
    SUM(COALESCE(net_weight, 0))                  AS net_kg
FROM boxes
WHERE status = 'closed' AND closed_at IS NOT NULL
GROUP BY 1;


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


-- ═══════════════════════════════════════════════════════════════
--  12. LOCK THE DOOR
--      Anonymous access is revoked entirely. The app reaches the
--      database only through server-side endpoints holding the
--      service role key, which bypasses RLS.
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE parcels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE boxes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;


-- ═══════════════════════════════════════════════════════════════
--  13. STARTER ACCOUNTS
--      Change these before sharing the link:
--        SELECT set_user_pin('cargo', '7391');
--      Add your own:
--        SELECT add_user('ravi', '4821', 'packer', 'Ravi K');
-- ═══════════════════════════════════════════════════════════════
SELECT add_user('admin',  '1234', 'admin',  'Admin');
SELECT add_user('cargo',  '0000', 'cargo',  'Cargo Team');
SELECT add_user('packer', '1111', 'packer', 'Packing Team');


-- PostgREST caches the table shape; without this the API keeps
-- serving the old column list and every query fails.
NOTIFY pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════
--  CHECK — parcels 0, logins 3+, packers preserved
-- ═══════════════════════════════════════════════════════════════
SELECT
    (SELECT COUNT(*) FROM parcels)          AS parcels,
    (SELECT COUNT(*) FROM parcel_items)     AS items,
    (SELECT COUNT(*) FROM boxes)            AS boxes,
    (SELECT COUNT(*) FROM app_users)        AS logins,
    (SELECT COUNT(*) FROM team_members)     AS packers,
    (SELECT COUNT(*) FROM delivery_cohorts) AS cohort_days;
