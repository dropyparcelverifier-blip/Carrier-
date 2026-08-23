import type { Shipment } from "./types";
import { COMPANY } from "./company";

/**
 * Reads from `date`'s own local hour — when called from a client component
 * with the default `new Date()`, that's the browser's system clock, which
 * is the standard web proxy for "the customer's own location": there's no
 * SSR/hydration mismatch risk here because ShipmentDetail (where this is
 * used) only ever mounts after a client-side fetch resolves, so it never
 * appears in server-rendered HTML — every call is a real client-side "now".
 */
export function timeGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first || fullName;
}

// Factual and specific to the stage — not a flat "your order is [status]"
// restatement of the pill above it, but B2B account communication, not
// consumer-app enthusiasm: no exclamation points, no "great news"/
// "winging its way" flourish. A business contact checking a shipment
// wants a status report, not a delight moment. "Forwarded to Courier"
// isn't a fixed string here — it takes the real courier name
// (Shiprocket/Velocity), so it's built by a function below instead of
// living in this static map.
const STATUS_HEADLINE: Record<Exclude<Shipment["status"], "Forwarded to Courier">, string> = {
  "Order Placed": "Your order has been received and is now in processing.",
  Processing: "Your order is being packed at our origin warehouse.",
  "In Transit": "Your order is in transit to India.",
  "Customs Clearance": "Your order is clearing customs in Mumbai.",
  "At Warehouse": "Your order has arrived at our Vashi warehouse.",
  Received: "Your order has passed quality check at our Vashi warehouse and is being prepared for last-mile handover.",
};

function forwardedHeadline(lastMileCourier: string | undefined): string {
  const via = lastMileCourier ? ` to ${lastMileCourier}` : "";
  return `Your order has been forwarded${via} for final delivery. Thank you for shipping with ${COMPANY.legalName}.`;
}

function lowerFirst(s: string): string {
  return s.length ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/**
 * A warm, time-aware greeting for the top of a tracking result, split into
 * a bold salutation and a factual status line — "here's a real update,
 * addressed to you" rather than a business contact having to parse a
 * status pill and a bare date themselves. B2B register: no exclamation
 * point on the salutation.
 */
export function orderGreeting(
  shipment: Pick<Shipment, "status" | "contactName" | "eta" | "lastMileCourier">,
  etaRelative: string | null,
  date: Date = new Date(),
): { salutation: string; message: string } {
  const name = firstName(shipment.contactName);
  const salutation = `${timeGreeting(date)}, ${name}.`;
  // "Received" (qc_check) now means QC-passed at Vashi, not doorstep
  // delivery — an ETA line still makes sense there. "Forwarded to
  // Courier" (handed_to_courier) is the actual terminal state this app
  // tracks: past that point, the real remaining ETA lives on the
  // last-mile courier's own tracking page (see TrackingEvent.courierLink),
  // not ours.
  const delivered = shipment.status === "Forwarded to Courier";
  const headline = delivered
    ? forwardedHeadline(shipment.lastMileCourier)
    : STATUS_HEADLINE[shipment.status as Exclude<Shipment["status"], "Forwarded to Courier">];
  const message = delivered
    ? headline
    : `${headline} Available ${lowerFirst(etaRelative ?? shipment.eta)}.`;
  return { salutation, message };
}
