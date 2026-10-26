import type { Handle } from "@sveltejs/kit";
import { brandForHost } from "$lib/brands";
import { brandHostAllows } from "$lib/server/brand-host";

/**
 * A brand's host (rudra.dotconnectslogistics.com) is an ADMIN-ONLY door.
 *
 * It serves the admin screens and their API and nothing else: no customer
 * tracking page, no /t/ or /c/ links, no Order Central bridge. A customer
 * link is always track.dotconnectslogistics.com; if one were ever built
 * on the brand host it 404s instead of working, so the mistake shows up
 * at once rather than the admin host spreading to customers.
 *
 * Every other host passes straight through — track., the Vercel URLs and
 * localhost behave exactly as before this file existed.
 */

export const handle: Handle = async ({ event, resolve }) => {
  if (!brandForHost(event.url.hostname)) return resolve(event);

  const path = event.url.pathname;
  if (path === "/") {
    return new Response(null, { status: 302, headers: { location: "/admin", "x-robots-tag": "noindex" } });
  }
  if (!brandHostAllows(path)) {
    return new Response("Not found", { status: 404, headers: { "x-robots-tag": "noindex" } });
  }
  const res = await resolve(event);
  res.headers.set("x-robots-tag", "noindex, nofollow");
  return res;
};
