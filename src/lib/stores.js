import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * The session lives in an httpOnly cookie the browser cannot read, so it is
 * handed down from the server through the root layout. These stores just
 * mirror it for components.
 */
export const session = writable(null);
export const role = derived(session, $s => $s?.role ?? 'none');
export const who  = derived(session, $s => $s?.display_name || $s?.username || '');

/**
 * Which warehouse the admin is looking at.
 *
 * Abhi and Bombino are separate operations that happen to arrive in one
 * report. A box built from the wrong stream is a real mistake, so the choice
 * is explicit, carried on every request, and remembered between visits.
 */
export const stream = writable('dropy');

// `browser` rather than a typeof check: recent Node versions define a
// localStorage global that has no working methods, so the typeof guard passed
// on the server and the first getItem threw, taking every page down with it.
if (browser) {
    try {
        const saved = localStorage.getItem('dropy_stream');
        if (saved === 'bm' || saved === 'dropy') stream.set(saved);
        stream.subscribe(v => {
            try { localStorage.setItem('dropy_stream', v); } catch { /* private mode */ }
        });
    } catch { /* storage blocked — the default stream still works */ }
}

/* ── Toast ── */
export const toast = writable({ msg: '', type: '', visible: false });
let timer;

export function showToast(msg, type = 'ok') {
    clearTimeout(timer);
    toast.set({ msg, type, visible: true });
    timer = setTimeout(() => toast.set({ msg: '', type: '', visible: false }), 3200);
}
