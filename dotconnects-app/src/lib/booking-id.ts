/**
 * The order number a customer placed, as the tracking page shows it.
 *
 * A split parcel's reference carries a -1/-2 leg suffix (the bridge from
 * Order Central adds it to dropy_order_id). The tracking ID already tells
 * parcels apart, so the booking shows the order itself: "#Dropy-4251".
 */
export function bookingId(ref: string | null | undefined): string {
  const r = String(ref ?? "").trim().replace(/^#/, "");
  return r ? `#${r.replace(/^(.+?-\d+)-\d{1,2}$/, "$1")}` : "—";
}
