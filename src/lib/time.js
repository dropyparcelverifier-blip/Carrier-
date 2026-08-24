/**
 * Timestamps are stored in UTC and shown in the reader's own zone:
 * the cargo team works in Jamaica NY, everyone else in India. Both see
 * the same moment described in the time they actually work in.
 */

export const ZONES = {
    cargo:  'America/New_York',
    admin:  'Asia/Kolkata',
    packer: 'Asia/Kolkata'
};

export const ZONE_LABEL = {
    'America/New_York': 'ET',
    'Asia/Kolkata': 'IST'
};

export function zoneFor(role) {
    return ZONES[role] ?? 'Asia/Kolkata';
}

export function labelFor(role) {
    return ZONE_LABEL[zoneFor(role)] ?? '';
}

const opts = (tz, extra) => ({ timeZone: tz, ...extra });

/** 14:32 */
export function clock(ts, role) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en-GB',
        opts(zoneFor(role), { hour: '2-digit', minute: '2-digit', hour12: false }));
}

/** 16 Aug */
export function dayShort(ts, role) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-GB',
        opts(zoneFor(role), { day: '2-digit', month: 'short' }));
}

/** 16 Aug, 14:32 */
export function stamp(ts, role) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('en-GB',
        opts(zoneFor(role), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }));
}

/** 16 AUG 2026 · 14:32 — for the received stamp */
export function stampLong(ts, role) {
    const d = ts ? new Date(ts) : new Date();
    const tz = zoneFor(role);
    return d.toLocaleDateString('en-GB', opts(tz, { day: '2-digit', month: 'short', year: 'numeric' })).toUpperCase()
        + ' · ' + d.toLocaleTimeString('en-GB', opts(tz, { hour: '2-digit', minute: '2-digit', hour12: false }));
}

/** Which calendar day a timestamp falls on, in the reader's zone.
 *  Returns YYYY-MM-DD so it can be grouped and sorted. */
export function dayKey(ts, role) {
    if (!ts) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: zoneFor(role), year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(ts));
    const g = t => parts.find(p => p.type === t)?.value ?? '';
    return `${g('year')}-${g('month')}-${g('day')}`;
}

/** Today, Yesterday, or 14 Aug — relative to the reader's zone. */
export function dayLabel(key, role) {
    if (!key) return '';
    const today = dayKey(new Date().toISOString(), role);
    if (key === today) return 'Today';

    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (key === dayKey(y.toISOString(), role)) return 'Yesterday';

    const [yr, m, d] = key.split('-').map(Number);
    return new Date(Date.UTC(yr, m - 1, d))
        .toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' });
}

/** Group timestamped rows into days, newest first. */
export function groupByDay(rows, field, role) {
    const map = new Map();
    for (const r of rows) {
        const k = dayKey(r[field], role);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(r);
    }
    return Array.from(map, ([key, items]) => ({
        key, label: dayLabel(key, role), items
    })).sort((a, b) => b.key.localeCompare(a.key));
}

/** Whole days between a YYYY-MM-DD date and today. */
export function ageDays(iso) {
    if (!iso) return 0;
    const n = Math.floor((Date.now() - new Date(iso + 'T00:00:00Z').getTime()) / 864e5);
    return Number.isFinite(n) ? Math.max(n, 0) : 0;
}
