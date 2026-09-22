import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "$env/dynamic/private";

/**
 * Signed tracking links — one tap from a WhatsApp or email button to the
 * customer's own tracking card, with no phone number in the link.
 *
 *   https://track.dotconnectslogistics.com/t/USLMT6V291D0045868-k7q2m9x4ab
 *                                            └── tracking id ──┘ └─ sig ─┘
 *
 * The signature is an HMAC of the tracking id under TRACK_LINK_SECRET,
 * which only Order Central and this app hold. Anyone can read the id in
 * the link; nobody can make a working link for a different id, or edit
 * this one, without the secret. That is what replaces the phone check for
 * these links: the phone proved the person typing owned the parcel; the
 * signature proves Order Central sent the link to that customer.
 *
 * Letters, digits and one hyphen only — Meta only accepts URL-safe values
 * in a template's URL button.
 *
 * MUST stay byte-for-byte identical to Order Central's
 * src/lib/server/track-link.js. Both test suites pin the same example
 * (see VECTOR below), so a drift on either side fails a test.
 */

const DOMAIN = "dot-track:v1:";
const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const SIG_LEN = 10; // 50 bits

/** Known answer shared with Order Central's tests. */
export const VECTOR = { secret: "vector-secret", id: "USLMT6V291D0045868" } as const;

function base32(bytes: Uint8Array): string {
  let out = "", bits = 0, value = 0;
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

const normalise = (id: string) => String(id ?? "").trim().toUpperCase();
const validId = (id: string) => /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(id);

function sigFor(id: string, secret: string): string {
  return base32(createHmac("sha256", secret).update(DOMAIN + id).digest()).slice(0, SIG_LEN);
}

/** The code for a tracking id, or "" when there is no secret or no id. */
export function signTrackCode(trackingId: string, secret = env.TRACK_LINK_SECRET ?? ""): string {
  const id = normalise(trackingId);
  if (!secret || !validId(id)) return "";
  return `${id}-${sigFor(id, secret)}`;
}

/** The tracking id a code was issued for, or null if it isn't genuine. */
export function verifyTrackCode(code: string, secret = env.TRACK_LINK_SECRET ?? ""): string | null {
  const raw = String(code ?? "").trim();
  const cut = raw.lastIndexOf("-");
  if (!secret || cut < 1) return null;
  const id = normalise(raw.slice(0, cut));
  const given = raw.slice(cut + 1).toLowerCase();
  if (!validId(id) || !/^[a-z2-7]{10}$/.test(given)) return null;
  const want = sigFor(id, secret);
  return timingSafeEqual(Buffer.from(given), Buffer.from(want)) ? id : null;
}
