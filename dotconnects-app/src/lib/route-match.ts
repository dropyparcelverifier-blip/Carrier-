/**
 * Which simulated journey an order gets.
 *
 * The route decides the origin city, the airline and how the stages are
 * spread across the window. It used to be picked at random from all 57
 * active routes, ignoring the days the order was actually sold on — so a
 * parcel leaving Newark on a 12-day promise could be given a 20-day
 * Atlanta route on the customer's map. No date was ever wrong (the ETA
 * and the clock come from shipping_days, never from the route), but the
 * gateway shown was one the parcel was never near.
 *
 * Matching keeps the variety — there are 3 to 8 shapes per length — while
 * making sure the shape is one of the right length.
 */
import type { OrderRoute } from "$lib/order-routes";

/**
 * The routes of the right length, or the nearest length that exists.
 *
 * The table covers 12 to 25. A request outside that range gets the
 * closest available rather than a refusal: the alternative is failing a
 * push over a cosmetic choice, and an order with no route at all renders
 * no journey for the customer.
 */
export function routesForDays(routes: OrderRoute[], days: number): OrderRoute[] {
  if (!routes.length) return [];
  const want = Number(days);
  if (!Number.isFinite(want)) return routes;
  const exact = routes.filter((r) => r.transitDays === want);
  if (exact.length) return exact;
  const best = routes.reduce(
    (acc, r) => Math.min(acc, Math.abs(r.transitDays - want)),
    Infinity,
  );
  return routes.filter((r) => Math.abs(r.transitDays - want) === best);
}

/** Deterministic given `seed`, so the same order always gets the same journey. */
export function pickRouteForDays(
  routes: OrderRoute[],
  days: number,
  seed: number,
): OrderRoute {
  const pool = routesForDays(routes, days);
  if (!pool.length) throw new Error("no routes available to assign");
  const h = Math.abs(Math.sin(seed * 12.9898) * 43758.5453);
  return pool[Math.floor((h - Math.floor(h)) * pool.length) % pool.length];
}
