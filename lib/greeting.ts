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

// Energetic, specific to the stage — not a flat "your order is [status]"
// restatement of the pill above it.
const STATUS_HEADLINE: Record<Shipment["status"], string> = {
  "Order Placed": "Great news — your order just landed in our system and we're already on it.",
  Processing: "Your order is being packed with care at our origin warehouse.",
  "In Transit": "Your order is on the move, winging its way to India.",
  "Customs Clearance": "Almost there — your order is clearing customs in Mumbai.",
  "At Warehouse": "Your order just touched down at our Vashi warehouse.",
  Received: "Your order passed quality check at our Vashi warehouse and is being handed off for final delivery.",
  "Out for Delivery": `Your order is on its last leg — handed off for final delivery to your doorstep. Thanks for shipping with ${COMPANY.legalName}!`,
};

function lowerFirst(s: string): string {
  return s.length ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/**
 * A warm, time-aware greeting for the top of a tracking result, split into
 * a bold salutation and an energetic status line — "here's a real update,
 * addressed to you" rather than a customer having to parse a status pill
 * and a bare date themselves.
 */
export function orderGreeting(
  shipment: Pick<Shipment, "status" | "contactName" | "eta">,
  etaRelative: string | null,
  date: Date = new Date(),
): { salutation: string; message: string } {
  const name = firstName(shipment.contactName);
  const salutation = `${timeGreeting(date)}, ${name}!`;
  // "Received" (qc_check) now means QC-passed at Vashi, not doorstep
  // delivery — an ETA line still makes sense there. "Out for Delivery"
  // (handed_to_courier) is the actual terminal state this app tracks: past
  // that point, the real remaining ETA lives on the last-mile courier's own
  // tracking page (see TrackingEvent.courierLink), not ours.
  const delivered = shipment.status === "Out for Delivery";
  const headline = STATUS_HEADLINE[shipment.status];
  const message = delivered
    ? headline
    : `${headline} Available ${lowerFirst(etaRelative ?? shipment.eta)}.`;
  return { salutation, message };
}
