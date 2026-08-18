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
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export const DEMO_SHIPMENTS: Shipment[] = [
  // ── Order 1: In Transit ──────────────────────────────────────
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
    originPort: "Dropy USA Warehouse — Newark, NJ",
    destination: "Andheri West, Mumbai, India",
    destinationPort: "Dropy Vashi Warehouse — Navi Mumbai",
    carrier: "Dropy Logistics",
    containerOrAwb: "098-4421-7788",
    pieces: 1, skuCount: 3, batchCount: 1,
    weightKg: 1.8, declaredValueUsd: 42, hsCode: "3304.99", dutyPaid: false,
    cdscoRegistration: null, fssaiLicence: null,
    shelfLifeRemaining: "", mrpLabelling: "Not started", tempControlled: false,
    shippedOn: dayOffset(-6), eta: dayOffset(4), progress: 55,
    items: [
      { name: "CeraVe Moisturizing Cream 16oz",        qty: 1, weight_g: 480, price_usd: 18 },
      { name: "Neutrogena Ultra Sheer SPF 70",          qty: 2, weight_g: 176, price_usd: 12 },
      { name: "Dove Deep Moisture Body Wash 22oz",      qty: 1, weight_g: 650, price_usd: 8  },
    ],
    totalItems: 4, shippingDays: 10, customerMobile: "9876543210",
    events: [
      { stage: "order_placed",        label: "Order placed",                   location: "dropy.in",                              timestamp: `${dayOffset(-9)} · 14:30 IST`, note: "Order confirmed. Payment received.",          state: "done"    },
      { stage: "processing",          label: "Processing & verification",      location: "Dropy USA Warehouse, Newark, NJ",       timestamp: `${dayOffset(-8)} · 09:15 EDT`, note: "Items picked and verified against order.",    state: "done"    },
      { stage: "packed",              label: "Packed at USA warehouse",        location: "Newark, NJ, USA",                       timestamp: `${dayOffset(-7)} · 11:40 EDT`, note: "Securely packed. Total weight: 1.8 kg.",      state: "done"    },
      { stage: "dispatched",          label: "Dispatched from warehouse",      location: "Newark, NJ, USA",                       timestamp: `${dayOffset(-6)} · 08:00 EDT`,                                                         state: "done"    },
      { stage: "at_us_airport",       label: "Arrived at US airport",          location: "JFK Airport, New York",                 timestamp: `${dayOffset(-6)} · 14:20 EDT`,                                                         state: "done"    },
      { stage: "us_customs_cleared",  label: "US export clearance complete",   location: "JFK Airport, New York",                 timestamp: `${dayOffset(-6)} · 18:45 EDT`,                                                         state: "done"    },
      { stage: "in_transit_departed", label: "Shipped — departed US",          location: "JFK Airport → Mumbai",                  timestamp: `${dayOffset(-5)} · 01:10 EDT`, note: "Flight EK202 via Dubai.",                      state: "done"    },
      { stage: "mid_transit",         label: "In transit — mid journey",       location: "International airspace",                timestamp: `${dayOffset(-1)} · 12:00 GST`,                                                         state: "current" },
      { stage: "arrived_india",       label: "Arrived at Mumbai airport (BOM)",location: "Chhatrapati Shivaji Intl Airport (BOM)",timestamp: "",                                                                                state: "pending" },
      { stage: "indian_customs",      label: "Indian customs clearance",       location: "Sahar Air Cargo Complex, Mumbai",       timestamp: "",                                                                                state: "pending" },
      { stage: "customs_cleared",     label: "Customs cleared",                location: "Mumbai, India",                         timestamp: "",                                                                                state: "pending" },
      { stage: "at_vashi_warehouse",  label: "Received at Vashi warehouse",    location: "Dropy Warehouse, Vashi, Navi Mumbai",   timestamp: "",                                                                                state: "pending" },
      { stage: "qc_check",            label: "Quality check — approved",       location: "Dropy Warehouse, Vashi, Navi Mumbai",   timestamp: "",                                                                                state: "pending" },
    ],
  },

  // ── Order 2: Customs Clearance ───────────────────────────────
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
    origin: "Newark, NJ, United States",
    originPort: "Dropy USA Warehouse — Newark, NJ",
    destination: "Powai, Mumbai, India",
    destinationPort: "Dropy Vashi Warehouse — Navi Mumbai",
    carrier: "Dropy Logistics",
    containerOrAwb: "098-4388-6652",
    pieces: 1, skuCount: 5, batchCount: 1,
    weightKg: 3.2, declaredValueUsd: 78, hsCode: "3307.49", dutyPaid: false,
    cdscoRegistration: null, fssaiLicence: null,
    shelfLifeRemaining: "", mrpLabelling: "Not started", tempControlled: false,
    shippedOn: dayOffset(-11), eta: dayOffset(1), progress: 72,
    items: [
      { name: "BBW A Thousand Wishes Candle 3-Wick",   qty: 2, weight_g: 820, price_usd: 26 },
      { name: "BBW Japanese Cherry Blossom Mist",       qty: 3, weight_g: 500, price_usd: 17 },
    ],
    totalItems: 5, shippingDays: 10, customerMobile: "9988776655",
    events: [
      { stage: "order_placed",        label: "Order placed",                   location: "dropy.in",                              timestamp: `${dayOffset(-13)} · 10:00 IST`,                                                         state: "done"    },
      { stage: "processing",          label: "Processing & verification",      location: "Dropy USA Warehouse, Newark, NJ",       timestamp: `${dayOffset(-12)} · 08:30 EDT`,                                                         state: "done"    },
      { stage: "packed",              label: "Packed at USA warehouse",        location: "Newark, NJ, USA",                       timestamp: `${dayOffset(-12)} · 16:00 EDT`,                                                         state: "done"    },
      { stage: "dispatched",          label: "Dispatched from warehouse",      location: "Newark, NJ, USA",                       timestamp: `${dayOffset(-11)} · 07:30 EDT`,                                                         state: "done"    },
      { stage: "at_us_airport",       label: "Arrived at US airport",          location: "EWR Airport, Newark",                   timestamp: `${dayOffset(-11)} · 12:00 EDT`,                                                         state: "done"    },
      { stage: "us_customs_cleared",  label: "US export clearance complete",   location: "EWR Airport, Newark",                   timestamp: `${dayOffset(-11)} · 17:30 EDT`,                                                         state: "done"    },
      { stage: "in_transit_departed", label: "Shipped — departed US",          location: "EWR Airport → Mumbai",                  timestamp: `${dayOffset(-10)} · 00:45 EDT`,                                                         state: "done"    },
      { stage: "mid_transit",         label: "In transit — mid journey",       location: "International airspace",                timestamp: `${dayOffset(-9)} · 06:00 GST`,                                                         state: "done"    },
      { stage: "arrived_india",       label: "Arrived at Mumbai airport (BOM)",location: "Chhatrapati Shivaji Intl Airport (BOM)",timestamp: `${dayOffset(-1)} · 05:30 IST`,                                                         state: "done"    },
      { stage: "indian_customs",      label: "Indian customs clearance",       location: "Sahar Air Cargo Complex, Mumbai",       timestamp: `${dayOffset(0)} · 11:00 IST`, note: "Under assessment. Expected clearance within 24 hours.", state: "current" },
      { stage: "customs_cleared",     label: "Customs cleared",                location: "Mumbai, India",                         timestamp: "",                                                                                state: "pending" },
      { stage: "at_vashi_warehouse",  label: "Received at Vashi warehouse",    location: "Dropy Warehouse, Vashi, Navi Mumbai",   timestamp: "",                                                                                state: "pending" },
      { stage: "qc_check",            label: "Quality check — approved",       location: "Dropy Warehouse, Vashi, Navi Mumbai",   timestamp: "",                                                                                state: "pending" },
    ],
  },

  // ── Order 3: Received at Vashi ───────────────────────────────
  {
    id: "DRP-2026-0350",
    reference: "ORD-9920",
    consignee: "Amit S.",
    consigneeCity: "Vashi, Navi Mumbai",
    contactName: "Amit S.",
    description: "Optimum Nutrition Gold Standard Whey, Creatine",
    category: "Supplements & Wellness",
    brands: ["Optimum Nutrition"],
    status: "Received",
    mode: "Air Freight",
    origin: "Newark, NJ, United States",
    originPort: "Dropy USA Warehouse — Newark, NJ",
    destination: "Vashi, Navi Mumbai, India",
    destinationPort: "Dropy Vashi Warehouse — Navi Mumbai",
    carrier: "Dropy Logistics",
    containerOrAwb: "098-4350-5501",
    pieces: 1, skuCount: 2, batchCount: 1,
    weightKg: 4.5, declaredValueUsd: 65, hsCode: "2106.90", dutyPaid: true,
    cdscoRegistration: null, fssaiLicence: null,
    shelfLifeRemaining: "", mrpLabelling: "Complete", tempControlled: false,
    shippedOn: "10 Jul 2026", eta: "22 Jul 2026", progress: 100,
    items: [
      { name: "ON Gold Standard 100% Whey 5lb — Double Rich Chocolate", qty: 1, weight_g: 2270, price_usd: 45 },
      { name: "ON Micronized Creatine Powder 300g",                      qty: 1, weight_g: 300,  price_usd: 20 },
    ],
    totalItems: 2, shippingDays: 10, customerMobile: "9112233445",
    events: [
      { stage: "order_placed",        label: "Order placed",                   location: "dropy.in",                              timestamp: "08 Jul 2026 · 18:00 IST",                                                                              state: "done" },
      { stage: "processing",          label: "Processing & verification",      location: "Dropy USA Warehouse, Newark, NJ",       timestamp: "09 Jul 2026 · 10:00 EDT",                                                                              state: "done" },
      { stage: "packed",              label: "Packed at USA warehouse",        location: "Newark, NJ, USA",                       timestamp: "09 Jul 2026 · 15:00 EDT",                                                                              state: "done" },
      { stage: "dispatched",          label: "Dispatched from warehouse",      location: "Newark, NJ, USA",                       timestamp: "10 Jul 2026 · 08:00 EDT",                                                                              state: "done" },
      { stage: "at_us_airport",       label: "Arrived at US airport",          location: "JFK Airport, New York",                 timestamp: "10 Jul 2026 · 13:00 EDT",                                                                              state: "done" },
      { stage: "us_customs_cleared",  label: "US export clearance complete",   location: "JFK Airport, New York",                 timestamp: "10 Jul 2026 · 18:00 EDT",                                                                              state: "done" },
      { stage: "in_transit_departed", label: "Shipped — departed US",          location: "JFK Airport → Mumbai",                  timestamp: "11 Jul 2026 · 02:00 EDT",                                                                              state: "done" },
      { stage: "mid_transit",         label: "In transit — mid journey",       location: "International airspace",                timestamp: "12 Jul 2026 · 08:00 GST",                                                                              state: "done" },
      { stage: "arrived_india",       label: "Arrived at Mumbai airport (BOM)",location: "BOM Airport, Mumbai",                   timestamp: "13 Jul 2026 · 06:00 IST",                                                                              state: "done" },
      { stage: "indian_customs",      label: "Indian customs clearance",       location: "Sahar Air Cargo Complex",               timestamp: "14 Jul 2026 · 10:00 IST",                                                                              state: "done" },
      { stage: "customs_cleared",     label: "Customs cleared",                location: "Mumbai, India",                         timestamp: "15 Jul 2026 · 09:00 IST",                                                                              state: "done" },
      { stage: "at_vashi_warehouse",  label: "Received at Vashi warehouse",    location: "Dropy Warehouse, Vashi, Navi Mumbai",   timestamp: "16 Jul 2026 · 14:00 IST",                                                                              state: "done" },
      { stage: "qc_check",            label: "Quality check — approved",       location: "Dropy Warehouse, Vashi, Navi Mumbai",   timestamp: "16 Jul 2026 · 16:30 IST", note: "Order received and handed off for onward delivery.", state: "done" },
    ],
  },
];
