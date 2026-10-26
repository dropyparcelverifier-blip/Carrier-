/** Which paths a brand admin host (rudra.…) serves. See hooks.server.ts. */

const ALLOWED = [
  /^\/admin(\/|$)/,
  /^\/api\/admin\/(login|logout|me|users|audit)(\/|$)/,
  /^\/api\/admin\/orders(\/|$)/,
  /^\/_app\//,
  /^\/(favicon[^/]*|logo\.png|robots\.txt)$/,
];
// The DOC bridge is server-to-server on the track host only.
const BLOCKED = [/^\/api\/admin\/orders\/from-order-central(\/|$)/];

export function brandHostAllows(pathname: string): boolean {
  if (BLOCKED.some((r) => r.test(pathname))) return false;
  return ALLOWED.some((r) => r.test(pathname));
}
