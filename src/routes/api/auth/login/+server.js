import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { setSessionCookie } from '$lib/server/session.js';

export async function POST({ request, cookies }) {
    let body;
    try { body = await request.json(); } catch { throw error(400, 'Bad request'); }

    const username = String(body?.username ?? '').trim().toLowerCase();
    const pin = String(body?.pin ?? '').trim();

    if (!username || !/^\d{4}$/.test(pin)) {
        throw error(400, 'Username and 4-digit PIN required');
    }

    // The PIN is compared inside Postgres against the bcrypt hash.
    // No hash is ever sent to this process.
    const { data, error: dbErr } = await db.rpc('verify_login', {
        p_username: username,
        p_pin: pin
    });

    if (dbErr) throw error(503, 'Cannot reach the server');

    const row = Array.isArray(data) ? data[0] : data;

    if (row?.locked) {
        throw error(429, `Too many attempts. Try again in ${row.retry_after} minutes.`);
    }

    if (!row?.username) {
        // Same message either way — don't reveal whether the username exists
        throw error(401, 'Username or PIN not recognised');
    }

    const user = {
        username: row.username,
        role: row.role,
        display_name: row.display_name || row.username
    };

    setSessionCookie(cookies, user);
    return json({ user });
}
