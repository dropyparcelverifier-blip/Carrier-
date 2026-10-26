/**
 * Brands — other stores of JD's that use DOT for the US leg.
 *
 * Dropy is the default and is NOT listed here: every existing order,
 * every DOC push and every existing admin login is Dropy, and stays
 * exactly as it was. A brand gets its own admin host and sees only its
 * own orders. Its customers get the ordinary track. link and the
 * ordinary DotConnects page — nothing on the customer side knows brands
 * exist.
 *
 * Adding a brand later = one entry here + `update admin_users set brand`.
 */

export type BrandKey = "rudra";

export type Brand = {
  key: BrandKey;
  name: string;
  /** Prefix of the store's order number as stored in dropy_order_id. */
  prefix: string;
  /** First DNS label of the brand's admin-only host (rudra.dotconnectslogistics.com). */
  hostLabel: string;
};

export const BRANDS: Record<BrandKey, Brand> = {
  rudra: { key: "rudra", name: "Rudra", prefix: "Rudra-", hostLabel: "rudra" },
};

export const DEFAULT_BRAND = "dropy";

export function isBrandKey(v: unknown): v is BrandKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(BRANDS, v);
}

/**
 * Which brand a host belongs to — by its first label, so
 * rudra.dotconnectslogistics.com and rudra.localhost both answer "rudra".
 * Every other host (track., dotconnect-seven.vercel.app, previews,
 * localhost) is the Dropy admin and answers null.
 */
export function brandForHost(host: string | null | undefined): BrandKey | null {
  const h = String(host ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  const first = h.split(".")[0] ?? "";
  if (!h.includes(".")) return null;
  for (const b of Object.values(BRANDS)) if (b.hostLabel === first) return b.key;
  return null;
}

/**
 * The brand's order number, whatever shape it was typed in:
 * "1042", "#1042", "rudra 1042", "Rudra-1042" → "Rudra-1042".
 * Digits only after the prefix; anything else is refused (null) rather
 * than stored as something the customer lookup can't find.
 */
export function brandOrderNo(brand: BrandKey, input: string): string | null {
  const b = BRANDS[brand];
  let s = String(input ?? "").trim();
  const name = b.prefix.replace(/-$/, "");
  s = s.replace(new RegExp(`^${name}[\\s_-]*`, "i"), "").replace(/^#/, "").trim();
  if (!/^\d{1,12}$/.test(s)) return null;
  return `${b.prefix}${s}`;
}

/** The public customer link host. Never a brand's admin host. */
export const PUBLIC_TRACK_BASE = "https://track.dotconnectslogistics.com";
