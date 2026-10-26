/**
 * The WhatsApp message a brand admin copies and sends by hand.
 *
 * Built in one place so the New-order screen and the order page always
 * produce the same text. The ETA block keeps one fact per line — easy to
 * read on a phone, and the same layout Dropy's own messages use.
 *
 * No payment line: DOT's payment_status is a form field nobody keeps
 * current for brand orders, and telling a customer "Unpaid" by mistake is
 * worse than saying nothing.
 */

import { etaFor, formatEta } from "$lib/dates";

type ShareOrder = {
  customer_name?: string | null;
  dropy_order_id?: string | null;
  customer_city?: string | null;
  estimated_delivery?: string | null;
  items?: unknown;
  order_date?: string | null;
  shipping_days?: number | null;
  doorstep_days?: number | null;
  delayed_at?: string | null;
  delay_total_ms?: number | null;
};

/** The doorstep date the customer page shows, or "" when there is none. */
function doorstepText(order: ShareOrder): string {
  if (!order.order_date || !order.shipping_days || !order.doorstep_days) return "";
  const { doorstep } = etaFor(order as any);
  return doorstep ? formatEta(doorstep) : "";
}

function itemsOf(order: ShareOrder): { name: string; qty: number }[] {
  const raw = typeof order.items === "string" ? safeParse(order.items) : order.items;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it: any) => ({ name: String(it?.name ?? it?.sku ?? "").trim(), qty: Number(it?.qty) || 1 }))
    .filter((it) => it.name);
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return []; }
}

const firstName = (n: string | null | undefined) => String(n ?? "").trim().split(/\s+/)[0] ?? "";

export function shareMessage(order: ShareOrder, link: string): string {
  const name = firstName(order.customer_name);
  const lines: string[] = [];
  lines.push(name ? `Hi ${name}! 👋` : "Hi! 👋");
  lines.push(`Your order ${order.dropy_order_id ?? ""} is on its way from the USA.`.replace("  ", " "));
  const items = itemsOf(order);
  if (items.length) {
    lines.push("");
    for (const it of items) lines.push(`📦 ${it.name} × ${it.qty}`);
  }
  lines.push("");
  lines.push("🌍 Dispatching from US warehouse ✈️");
  if (order.estimated_delivery) lines.push(`🏭 India Warehouse ETA: ${order.estimated_delivery}`);
  const door = doorstepText(order);
  if (door) lines.push(`🏠 Expected at your door: ${door}`);
  lines.push("🚚 Delivery Dispatch: Same day after quality checks");
  if (order.customer_city) lines.push(`📍 Delivering to: ${order.customer_city}`);
  lines.push("🔔 Live tracking updates on this link:");
  lines.push(link);
  return lines.join("\n");
}
