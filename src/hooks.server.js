import { readSession, COOKIE } from '$lib/server/session.js';
import { redirect, error } from '@sveltejs/kit';

/** Which roles may reach which paths. Checked on the server, so a
 *  hidden nav item is not the thing keeping anyone out. */
const ACCESS = {
    '/dashboard': ['admin'],
    '/upload':    ['admin'],
    '/parcels':   ['admin', 'cargo'],
    '/overview':  ['admin', 'cargo'],
    '/scan':      ['admin', 'cargo'],
    '/boxes':     ['admin', 'packer'],
    '/attention': ['admin'],
    '/settings':  ['admin'],
    '/bm':        ['admin'],
    '/analysis':  ['admin']
};

const API_ACCESS = {
    '/api/dashboard': ['admin'],
    '/api/upload':    ['admin'],
    '/api/parcels':   ['admin', 'cargo'],
    '/api/manifest':  ['admin', 'cargo'],
    '/api/overview':  ['admin', 'cargo'],
    '/api/scan':      ['admin', 'cargo'],
    '/api/boxes':     ['admin', 'packer'],
    '/api/cohorts':   ['admin'],
    '/api/attention': ['admin'],
    // The parcel export is tracking numbers and statuses — no rates — so the
    // cargo team can pull their own list. The box file does carry rates and
    // checks for admin inside its own handler.
    '/api/export':    ['admin', 'cargo'],
    '/api/settings':  ['admin'],
    '/api/bm':        ['admin'],
    '/api/analysis':  ['admin']
};

function allowed(map, path) {
    const key = Object.keys(map).find(k => path === k || path.startsWith(k + '/'));
    return key ? map[key] : null;
}

export async function handle({ event, resolve }) {
    event.locals.user = readSession(event.cookies.get(COOKIE));

    const path = event.url.pathname;

    // API: answer with a status code, never a redirect
    if (path.startsWith('/api/')) {
        const open = path.startsWith('/api/auth/');
        if (!open) {
            if (!event.locals.user) throw error(401, 'Not signed in');
            const roles = allowed(API_ACCESS, path);
            if (roles && !roles.includes(event.locals.user.role)) {
                throw error(403, 'Not allowed');
            }
        }
        return resolve(event);
    }

    // Pages: send people somewhere useful
    const roles = allowed(ACCESS, path);
    if (roles) {
        if (!event.locals.user) throw redirect(303, '/');
        if (!roles.includes(event.locals.user.role)) {
            const home = { admin: '/dashboard', cargo: '/scan', packer: '/boxes' };
            throw redirect(303, home[event.locals.user.role] ?? '/');
        }
    }

    return resolve(event);
}
