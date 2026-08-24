import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

/** Read on use rather than at import, so a build machine without secrets
 *  still builds. A weak secret is refused — a guessable one would let
 *  anybody mint themselves an admin session. */
function secret() {
    const s = env.SESSION_SECRET;
    if (!s || s.length < 16) {
        throw new Error(
            `SESSION_SECRET is missing or too short.\n\n` +
            `Generate one with:\n` +
            `  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"\n\n` +
            `Local: add it to .env and restart.\n` +
            `Vercel: Settings → Environment Variables, then redeploy.`
        );
    }
    return s;
}

const COOKIE = 'dropy_session';
const MAX_AGE = 60 * 60 * 24 * 30;   // 30 days — the warehouse shouldn't re-login daily

function b64url(buf) {
    return Buffer.from(buf).toString('base64url');
}

function sign(payload) {
    return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/**
 * A session is `<payload>.<signature>`, where payload is base64url JSON.
 * The contents are readable but not forgeable: changing the role would
 * invalidate the signature, and only the server holds the secret.
 */
export function createSession(user) {
    const payload = b64url(JSON.stringify({
        u: user.username,
        r: user.role,
        n: user.display_name || user.username,
        e: Date.now() + MAX_AGE * 1000
    }));
    return `${payload}.${sign(payload)}`;
}

export function readSession(token) {
    if (!token || typeof token !== 'string') return null;

    const dot = token.lastIndexOf('.');
    if (dot < 1) return null;

    const payload = token.slice(0, dot);
    const given = token.slice(dot + 1);
    const want = sign(payload);

    // Constant-time compare so a mismatch can't be found byte by byte
    const a = Buffer.from(given);
    const b = Buffer.from(want);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    try {
        const s = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (!s?.u || !s?.r) return null;
        if (!s.e || Date.now() > s.e) return null;
        return { username: s.u, role: s.r, display_name: s.n };
    } catch {
        return null;
    }
}

export function setSessionCookie(cookies, user) {
    cookies.set(COOKIE, createSession(user), {
        path: '/',
        httpOnly: true,      // scripts cannot read it, so XSS can't lift the session
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: MAX_AGE
    });
}

export function clearSessionCookie(cookies) {
    cookies.delete(COOKIE, { path: '/' });
}

export { COOKIE };

/** Generates a secret for first-time setup. */
export function suggestSecret() {
    return randomBytes(32).toString('base64url');
}
