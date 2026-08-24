import { stream } from './stores.js';

/**
 * The browser talks to our own endpoints, never to the database.
 * Every call returns { ok, data, reason, message } so callers can tell a
 * refusal apart from a dropped connection.
 */

async function call(path, opts = {}) {
    let res;
    try {
        res = await fetch(path, {
            ...opts,
            headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) }
        });
    } catch {
        // Never reached the server — safe to retry
        return { ok: false, reason: 'offline', message: 'No connection', data: null };
    }

    let body = null;
    try { body = await res.json(); } catch { /* empty or non-JSON */ }

    if (!res.ok) {
        return {
            ok: false,
            reason: res.status === 401 ? 'unauthorised'
                  : res.status === 429 ? 'locked'
                  : res.status >= 500 ? 'offline' : 'refused',
            status: res.status,
            message: body?.message ?? body?.error?.message ?? 'Something went wrong',
            data: body
        };
    }

    return { ok: true, data: body, reason: 'ok' };
}

/** The stream currently selected, read synchronously for request building. */
let CURRENT = 'dropy';
stream.subscribe(v => { CURRENT = v; });

/** Every read carries the stream, so a screen can never quietly show the
 *  other warehouse's parcels. Writes name their own target instead. */
function withStream(p) {
    if (p.includes('stream=')) return p;
    return p + (p.includes('?') ? '&' : '?') + 'stream=' + CURRENT;
}

export const api = {
    get:   (p)      => call(withStream(p)),
    post:  (p, b)   => call(p, { method: 'POST',  body: JSON.stringify(b ?? {}) }),
    patch: (p, b)   => call(p, { method: 'PATCH', body: JSON.stringify(b ?? {}) })
};

/* ── auth ── */
export const login  = (username, pin) => api.post('/api/auth/login', { username, pin });
export const logout = () => api.post('/api/auth/logout');

/* ── parcels ── */
export const listParcels = (o = {}) => {
    const q = new URLSearchParams({
        filter: o.filter ?? 'hold',
        page: String(o.page ?? 0),
        size: String(o.size ?? 10),
        ...(o.q ? { q: o.q } : {})
    });
    return api.get(`/api/parcels?${q}`);
};
export const findParcel   = (q) => api.get(`/api/parcels?mode=find&q=${encodeURIComponent(q)}`);
export const receive      = (tracking) => api.post('/api/parcels', { action: 'receive', tracking });
export const unreceive    = (tracking) => api.post('/api/parcels', { action: 'unreceive', tracking });
export const logUnmatched = (tracking) => api.post('/api/parcels', { action: 'log_unmatched', tracking });
export const logDuplicate = (tracking) => api.post('/api/parcels', { action: 'log_duplicate', tracking });
export const setAttention = (tracking, state, note) =>
    api.post('/api/parcels', { action: 'attention', tracking, state, note });

/* ── scan ── */
export const scanState = () => api.get('/api/scan');

/* ── dashboard ── */
export const dashboard = () => api.get('/api/dashboard');

/* ── intake ── */
export const uploadHistory = () => api.get('/api/upload');
export const pushUpload    = (payload) => api.post('/api/upload', payload);

/* ── overview: what is waiting at the warehouse ── */
export const overview = (o = {}) => {
    const p = new URLSearchParams();
    if (o.q) p.set('q', o.q);
    if (o.op) p.set('op', o.op);
    if (o.days != null && o.days !== '') p.set('days', String(o.days));
    if (o.sort) p.set('sort', o.sort);
    if (o.dir) p.set('dir', o.dir);
    return api.get(`/api/overview${p.toString() ? '?' + p : ''}`);
};

/* ── manifest calendar ── */
export const manifestMonth = (month) =>
    api.get(`/api/manifest${month ? `?month=${month}` : ''}`);
export const manifestDay = (day, o = {}) => {
    const p = new URLSearchParams({
        day, group: o.group ?? 'missing',
        by: o.by ?? 'ordered',
        from: String(o.from ?? 0), size: String(o.size ?? 25)
    });
    if (o.q) p.set('q', o.q);
    return api.get(`/api/manifest?${p}`);
};

/* ── cohorts & attention ── */
export const cohorts    = () => api.get('/api/cohorts');
export const cohortDay  = (day) => api.get(`/api/cohorts?day=${encodeURIComponent(day)}`);
export const attention  = () => api.get('/api/attention');
export const settle     = (tracking, state, note) =>
    api.post('/api/attention', { action: 'settle', tracking, state, note });
export const unsettle   = (tracking) => api.post('/api/attention', { action: 'reopen', tracking });
export const settleMany = (trackings, state, note) =>
    api.post('/api/attention', { action: 'settle_many', trackings, state, note });
export const dismissMany = (trackings) =>
    api.post('/api/attention', { action: 'dismiss_many', trackings });
export const dismissScan = (tracking) => api.post('/api/attention', { action: 'dismiss_scan', tracking });

/** The box file. Pass a day for every box closed that day, or a single box id.
 *  Both produce the same columns. */
export function downloadBoxFile({ day, box }) {
    const q = new URLSearchParams(day ? { day } : { box });
    window.location.href = `/api/export/boxes?${q}`;
}

/** Excel download — navigating triggers the browser's save dialog. */
export function downloadXlsx(what, extra = {}) {
    const q = new URLSearchParams({ what, ...extra });
    window.location.href = `/api/export?${q}`;
}

/* ── analysis ── */
export const journey = (q, o = {}) => {
    const p = new URLSearchParams({ q });
    if (o.from) p.set('from', String(o.from));
    if (o.size) p.set('size', String(o.size));
    return api.get(`/api/analysis/journey?${p}`);
};
export const weightMap = (o = {}) => {
    const p = new URLSearchParams({ view: 'weights' });
    if (o.q) p.set('q', o.q);
    if (o.sort) p.set('sort', o.sort);
    if (o.dir) p.set('dir', o.dir);
    if (o.from) p.set('from', String(o.from));
    if (o.size) p.set('size', String(o.size));
    return api.get(`/api/analysis?${p}`);
};
export const discrepancies = (q = '') => {
    const p = new URLSearchParams({ view: 'discrepancies' });
    if (q) p.set('q', q);
    return api.get(`/api/analysis?${p}`);
};
export const turnaround = () => api.get('/api/analysis?view=turnaround');

/* ── BM ── */
export const bmAvailable = (o = {}) => {
    const q = new URLSearchParams({ view: 'available',
        from: String(o.from ?? 0), size: String(o.size ?? 30) });
    if (o.q) q.set('q', o.q);
    return api.get(`/api/bm?${q}`);
};
export const bmManifest = (o = {}) => {
    const q = new URLSearchParams({ view: 'manifest',
        from: String(o.from ?? 0), size: String(o.size ?? 50) });
    if (o.day) q.set('day', o.day);
    if (o.by) q.set('by', o.by);
    if (o.state) q.set('state', o.state);
    if (o.q) q.set('q', o.q);
    return api.get(`/api/bm?${q}`);
};
export const bmDays      = () => api.get('/api/bm?view=days');
export const bmAdd       = (box_id, item_id, qty, weight_g, reason = '') =>
    api.post('/api/bm', { action: 'add', box_id, item_id, qty, weight_g, reason });
export const bmRemove    = (box_id, row_id) =>
    api.post('/api/bm', { action: 'remove', box_id, row_id });
export const bmDeleteBox = (box_id) =>
    api.post('/api/bm', { action: 'delete_box', box_id });
export const bmMarkSent  = (trackings, note) =>
    api.post('/api/bm', { action: 'mark_sent', trackings, note });
export const bmUnmarkSent = (trackings) =>
    api.post('/api/bm', { action: 'unmark_sent', trackings });

/* ── settings ── */
export const getSettings  = () => api.get('/api/settings');
export const saveSetting  = (payload) => api.post('/api/settings', payload);

/* ── boxes ── */
export const listBoxes  = () => api.get('/api/boxes');
export const createBox  = (b) => api.post('/api/boxes', b);
export const getBox     = (id) => api.get(`/api/boxes/${encodeURIComponent(id)}`);
/** Candidates for a box — a list to choose from, never an automatic pick. */
export const searchForBox = (id, term) =>
    api.get(`/api/boxes/${encodeURIComponent(id)}?find=${encodeURIComponent(term)}`);
export const pullParcel = (id, term) =>
    api.get(`/api/boxes/${encodeURIComponent(id)}?pull=${encodeURIComponent(term)}`);
export const addToBox   = (id, tracking, items, force = false) =>
    api.post(`/api/boxes/${encodeURIComponent(id)}`, { tracking, items, force });
export const removeFromBox = (id, tracking) =>
    api.patch(`/api/boxes/${encodeURIComponent(id)}`, { action: 'remove', tracking });
export const closeBox   = (id, empty_weight) =>
    api.patch(`/api/boxes/${encodeURIComponent(id)}`, { action: 'close', empty_weight });
export const setRowWeight = (id, row_id, weight_g) =>
    api.patch(`/api/boxes/${encodeURIComponent(id)}`, { action: 'set_weight', row_id, weight_g });
export const deleteBox  = (id) =>
    call(`/api/boxes/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const reopenBox  = (id) =>
    api.patch(`/api/boxes/${encodeURIComponent(id)}`, { action: 'reopen' });
