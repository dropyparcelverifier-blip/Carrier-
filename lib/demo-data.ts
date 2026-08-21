import type { Shipment } from "./types";

/*
 * The two non-delivered demo shipments (In Transit, Customs Clearance) need
 * their dates computed relative to today, not hardcoded — a fixed "eta: 05
 * Aug 2026" reads as fine on the day it was written, then a week later
 * becomes an ETA in the past for an order that (per its own status) hasn't
 * arrived yet. relativeDays() then honestly reports that as "8 days ago",
 * which is correct given the input but reads as a broken demo. Computing
 * from `new Date()` here keeps the demo evergreen instead of needing dates
 * bumped by hand every so often.
 *
 * The delivered demo shipment (Received) keeps fixed historical dates —
 * a past ETA on an order that's already arrived is exactly right, not a
 * bug, so there's nothing to fix there.
 *
 * Locations below are drawn from three of the real routes in lib/routes.ts
 * (newark-frankfurt-mumbai, chicago-dubai-mumbai, seattle-tokyo-mumbai) —
 * a plain Shipment has no route_key of its own (only the raw Supabase
 * OrderRow does; shipment-service.ts resolves it away into static
 * event.location strings before it becomes a Shipment), so these three
 * demo orders each hand-pick a different real route's waypoints instead of
 * all three repeating the one flat JFK/EWR path the old data used.
 * Categories cover three of the eight lib/quote.ts PRODUCT_CATEGORIES
 * (skincare, fragrance, electronics) rather than clustering on the
 * original personal-care set alone.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export const DEMO_SHIPMENTS: Shipment[] = [
  // ── Order 1: In Transit — Newark -> Frankfurt -> Mumbai -> Vashi ──
  {
    id: "DRP-2026-0421",
    reference: "ORD-9981",
    consignee: "Rahul M.",
    consigneeCity: "Andheri West, Mumbai",
    contactName: "Rahul M.",
    description: "CeraVe Moisturizer, Neutrogena Sunscreen, Dove Body Wash",
    category: "Skincare & Personal Care",
    brands: ["CeraVe", "Neutrogena", "Dove"],
    status: "In Transit",
    mode: "Air Freight",
    origin: "Newark, NJ, United States",
    originPort: "DotConnects Logistics USA Warehouse — Newark, NJ",
    destination: "Andheri West, Mumbai, India",
    destinationPort: "DotConnects Logistics Vashi Warehouse — Navi Mumbai",
    carrier: "DotConnects Logistics",
    containerOrAwb: "098-4421-7788",
    pieces: 1, skuCount: 3, batchCount: 1,
    weightKg: 1.8, declaredValueUsd: 42, hsCode: "3304.99", dutyPaid: false,
    cdscoRegistration: null, fssaiLicence: null,
    shelfLifeRemaining: "", tempControlled: false,
    shippedOn: dayOffset(-6), eta: dayOffset(4), progress: 55,
    items: [
      { name: "CeraVe Moisturizing Cream 16oz",        qty: 1, weight_g: 480, price_usd: 18 },
      { name: "Neutrogena Ultra Sheer SPF 70",          qty: 2, weight_g: 176, price_usd: 12 },
      { name: "Dove Deep Moisture Body Wash 22oz",      qty: 1, weight_g: 650, price_usd: 8  },
    ],
    totalItems: 4, shippingDays: 7, customerMobile: "9876543210",
    events: [
      { stage: "order_placed",        label: "Order placed",                   location: "dotconnectslogistics.in",                                     timestamp: `${dayOffset(-9)} · 14:30 IST`, note: "Order confirmed. Payment received.",       state: "done"    },
      { stage: "processing",          label: "Processing & verification",      location: "CeraVe / L'Oreal USA Distribution, Newark, NJ",       timestamp: `${dayOffset(-8)} · 09:15 EDT`, note: "Items picked and verified against order.", state: "done"    },
      { stage: "packed",              label: "Packed at origin warehouse",        location: "DotConnects Logistics Pickup Warehouse, Newark, NJ",          timestamp: `${dayOffset(-7)} · 11:40 EDT`, note: "Securely packed. Total weight: 1.8 kg.",   state: "done"    },
      { stage: "dispatched",          label: "Dispatched from warehouse",      location: "Newark Liberty Intl Airport (EWR), NJ", carrier: "FedEx", timestamp: `${dayOffset(-6)} · 08:00 EDT`,                                                     state: "done"    },
      { stage: "at_us_airport",       label: "Arrived at departure gateway",          location: "Newark Liberty Intl Airport (EWR), NJ",               timestamp: `${dayOffset(-6)} · 14:20 EDT`,                                                              state: "done"    },
      { stage: "us_customs_cleared",  label: "Export clearance complete",   location: "Newark Liberty Intl Airport (EWR), NJ",               timestamp: `${dayOffset(-6)} · 18:45 EDT`,                                                              state: "done"    },
      { stage: "in_transit_departed", label: "Shipped — departed origin",          location: "Airspace over the Atlantic — en route to Frankfurt",  timestamp: `${dayOffset(-5)} · 01:10 EDT`,          note: "Routing via Frankfurt.",                    state: "done"    },
      { stage: "mid_transit",         label: "In transit — mid journey",       location: "Frankfurt Airport (FRA), Germany — transit hub",      timestamp: `${dayOffset(-1)} · 12:00 CET`,                                                              state: "current" },
      { stage: "arrived_india",       label: "Arrived in India", location: "Chhatrapati Shivaji Intl Airport (BOM), Mumbai",      timestamp: "",                                                                                          state: "pending" },
      { stage: "indian_customs",      label: "Indian customs clearance",       location: "Sahar Air Cargo Complex, Mumbai",                     timestamp: "",                                                                                          state: "pending" },
      { stage: "customs_cleared",     label: "Customs cleared",                location: "Mumbai, Maharashtra",                                 timestamp: "",                                                                                          state: "pending" },
      { stage: "at_vashi_warehouse",  label: "Received at Vashi warehouse",    location: "DotConnects Logistics Warehouse, Vashi, Navi Mumbai",         timestamp: "",                                                                                          state: "pending" },
      { stage: "qc_check",            label: "Quality check — approved",       location: "DotConnects Logistics Warehouse, Vashi, Navi Mumbai",         timestamp: "",                                                                                          state: "pending" },
    ],
  },

  // ── Order 2: Customs Clearance — Chicago -> Dubai -> Mumbai -> Vashi ──
  {
    id: "DRP-2026-0388",
    reference: "ORD-9955",
    consignee: "Priya K.",
    consigneeCity: "Powai, Mumbai",
    contactName: "Priya K.",
    description: "Bath & Body Works candles and mists",
    category: "Fragrance & Home",
    brands: ["Bath & Body Works"],
    status: "Customs Clearance",
    mode: "Air Freight",
    origin: "Chicago, IL, United States",
    originPort: "DotConnects Logistics USA Warehouse — Chicago, IL",
    destination: "Powai, Mumbai, India",
    destinationPort: "DotConnects Logistics Vashi Warehouse — Navi Mumbai",
    carrier: "DotConnects Logistics",
    containerOrAwb: "098-4388-6652",
    pieces: 1, skuCount: 5, batchCount: 1,
    weightKg: 3.2, declaredValueUsd: 78, hsCode: "3307.49", dutyPaid: false,
    cdscoRegistration: null, fssaiLicence: null,
    shelfLifeRemaining: "", tempControlled: false,
    shippedOn: dayOffset(-11), eta: dayOffset(1), progress: 72,
    items: [
      { name: "BBW A Thousand Wishes Candle 3-Wick",   qty: 2, weight_g: 820, price_usd: 26 },
      { name: "BBW Japanese Cherry Blossom Mist",       qty: 3, weight_g: 500, price_usd: 17 },
    ],
    totalItems: 5, shippingDays: 8, customerMobile: "9988776655",
    events: [
      { stage: "order_placed",        label: "Order placed",                   location: "dotconnectslogistics.in",                                  timestamp: `${dayOffset(-13)} · 10:00 IST`, state: "done"    },
      { stage: "processing",          label: "Processing & verification",      location: "Bath & Body Works DC, Chicago, IL",                timestamp: `${dayOffset(-12)} · 08:30 CDT`, state: "done"    },
      { stage: "packed",              label: "Packed at origin warehouse",        location: "DotConnects Logistics Pickup Warehouse, Chicago, IL",      timestamp: `${dayOffset(-12)} · 16:00 CDT`, state: "done"    },
      { stage: "dispatched",          label: "Dispatched from warehouse",      location: "O'Hare Intl Airport (ORD), Chicago, IL", carrier: "UPS", timestamp: `${dayOffset(-11)} · 07:30 CDT`, state: "done"    },
      { stage: "at_us_airport",       label: "Arrived at departure gateway",          location: "O'Hare Intl Airport (ORD), Chicago, IL",           timestamp: `${dayOffset(-11)} · 12:00 CDT`,                                                                             state: "done"    },
      { stage: "us_customs_cleared",  label: "Export clearance complete",   location: "O'Hare Intl Airport (ORD), Chicago, IL",           timestamp: `${dayOffset(-11)} · 17:30 CDT`,                                                                             state: "done"    },
      { stage: "in_transit_departed", label: "Shipped — departed origin",          location: "Airspace over the Atlantic — en route to Dubai",   timestamp: `${dayOffset(-10)} · 00:45 CDT`,                                                                             state: "done"    },
      { stage: "mid_transit",         label: "In transit — mid journey",       location: "Dubai Intl Airport (DXB), UAE — transit hub",      timestamp: `${dayOffset(-9)} · 06:00 GST`,                                                                              state: "done"    },
      { stage: "arrived_india",       label: "Arrived in India", location: "Chhatrapati Shivaji Intl Airport (BOM), Mumbai",   timestamp: `${dayOffset(-1)} · 05:30 IST`,                                                                              state: "done"    },
      { stage: "indian_customs",      label: "Indian customs clearance",       location: "Sahar Air Cargo Complex, Mumbai",                  timestamp: `${dayOffset(0)} · 11:00 IST`, note: "Under assessment. Expected clearance within 24 hours.", state: "current" },
      { stage: "customs_cleared",     label: "Customs cleared",                location: "Mumbai, Maharashtra",                              timestamp: "",                                                                                                          state: "pending" },
      { stage: "at_vashi_warehouse",  label: "Received at Vashi warehouse",    location: "DotConnects Logistics Warehouse, Vashi, Navi Mumbai",      timestamp: "",                                                                                                          state: "pending" },
      { stage: "qc_check",            label: "Quality check — approved",       location: "DotConnects Logistics Warehouse, Vashi, Navi Mumbai",      timestamp: "",                                                                                                          state: "pending" },
    ],
  },

  // ── Order 3: Received at Vashi — Seattle -> Tokyo -> Mumbai -> Vashi ──
  {
    id: "DRP-2026-0350",
    reference: "ORD-9920",
    consignee: "Amit S.",
    consigneeCity: "Vashi, Navi Mumbai",
    contactName: "Amit S.",
    description: "Anker PowerCore Battery Pack, Soundcore Earbuds",
    category: "Electronics & Accessories",
    brands: ["Anker", "Soundcore"],
    status: "Forwarded to Courier",
    mode: "Air Freight",
    origin: "Seattle, WA, United States",
    originPort: "DotConnects Logistics USA Warehouse — Seattle, WA",
    destination: "Vashi, Navi Mumbai, India",
    destinationPort: "DotConnects Logistics Vashi Warehouse — Navi Mumbai",
    carrier: "DotConnects Logistics",
    containerOrAwb: "098-4350-5501",
    pieces: 1, skuCount: 2, batchCount: 1,
    weightKg: 1.1, declaredValueUsd: 58, hsCode: "8507.60", dutyPaid: true,
    cdscoRegistration: null, fssaiLicence: null,
    shelfLifeRemaining: "", tempControlled: false,
    shippedOn: "10 Jul 2026", eta: "22 Jul 2026", progress: 100,
    lastMileCourier: "Shiprocket", lastMileAwb: "SR8231774920",
    lastMileTrackingUrl: "https://shiprocket.co/tracking/SR8231774920",
    items: [
      { name: "Anker PowerCore 26800mAh Portable Charger", qty: 1, weight_g: 490, price_usd: 40 },
      { name: "Soundcore Life Q30 Wireless Earbuds",        qty: 1, weight_g: 210, price_usd: 18 },
    ],
    totalItems: 2, shippingDays: 8, customerMobile: "9112233445",
    events: [
      // 08-09 Jul are a Wed/Thu — orders placed on a normal India business
      // day. The Seattle-side steps below (09-10 Jul, Thu/Fri) land on real
      // US warehouse working days too — this fixed-date order was already
      // clear of the weekend on both ends; only the Bengaluru waypoints and
      // shippingDays (was 10, didn't match its own 12-calendar-day
      // shipped->eta window) needed correcting.
      { stage: "order_placed",        label: "Order placed",                   location: "dotconnectslogistics.in",                                     timestamp: "08 Jul 2026 · 18:00 IST",  state: "done" },
      { stage: "processing",          label: "Processing & verification",      location: "Amazon US Fulfillment, Seattle, WA",                  timestamp: "09 Jul 2026 · 10:00 PDT",  state: "done" },
      { stage: "packed",              label: "Packed at origin warehouse",        location: "DotConnects Logistics Pickup Warehouse, Seattle, WA",         timestamp: "09 Jul 2026 · 15:00 PDT",  state: "done" },
      { stage: "dispatched",          label: "Dispatched from warehouse",      location: "Seattle-Tacoma Intl Airport (SEA), WA", carrier: "DHL Express", timestamp: "10 Jul 2026 · 08:00 PDT",  state: "done" },
      { stage: "at_us_airport",       label: "Arrived at departure gateway",          location: "Seattle-Tacoma Intl Airport (SEA), WA",               timestamp: "10 Jul 2026 · 13:00 PDT",  state: "done" },
      { stage: "us_customs_cleared",  label: "Export clearance complete",   location: "Seattle-Tacoma Intl Airport (SEA), WA",               timestamp: "10 Jul 2026 · 18:00 PDT",  state: "done" },
      { stage: "in_transit_departed", label: "Shipped — departed origin",          location: "Airspace over the Pacific — en route to Tokyo",       timestamp: "11 Jul 2026 · 02:00 PDT",  state: "done" },
      { stage: "mid_transit",         label: "In transit — mid journey",       location: "Narita Intl Airport (NRT), Tokyo — transit hub",      timestamp: "12 Jul 2026 · 08:00 JST",  state: "done" },
      { stage: "arrived_india",       label: "Arrived in India", location: "Chhatrapati Shivaji Intl Airport (BOM), Mumbai",     timestamp: "13 Jul 2026 · 06:00 IST",  state: "done" },
      { stage: "indian_customs",      label: "Indian customs clearance",       location: "Sahar Air Cargo Complex, Mumbai",                     timestamp: "14 Jul 2026 · 10:00 IST",  state: "done" },
      { stage: "customs_cleared",     label: "Customs cleared",                location: "Mumbai, Maharashtra",                                 timestamp: "15 Jul 2026 · 09:00 IST",  state: "done" },
      { stage: "at_vashi_warehouse",  label: "Received at Vashi warehouse",    location: "DotConnects Logistics Warehouse, Vashi, Navi Mumbai",         timestamp: "16 Jul 2026 · 14:00 IST",  state: "done" },
      { stage: "qc_check",            label: "Quality check — approved",       location: "DotConnects Logistics Warehouse, Vashi, Navi Mumbai",         timestamp: "16 Jul 2026 · 16:30 IST", note: "Quality check passed — preparing last-mile handover.", state: "done" },
      { stage: "handed_to_courier",   label: "Handed to last-mile courier",    location: "DotConnects Logistics Warehouse, Vashi, Navi Mumbai", carrier: "Shiprocket", courierLink: "https://shiprocket.co/tracking/SR8231774920", timestamp: "17 Jul 2026 · 09:15 IST", note: "AWB SR8231774920 — track delivery on Shiprocket's site.", state: "done" },
    ],
  },
];
