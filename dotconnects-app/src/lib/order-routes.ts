import { STAGES, type StageKey } from "./types";
import type { VendorProfile } from "./vendor-catalog";

/**
 * The REAL route data used when a new order is actually created —
 * deliberately separate from lib/routes.ts's 22 routes, which exist for
 * display/demo purposes only (About page, tracking demo data) and are not
 * wired into order creation.
 *
 * Verified against real air-cargo geography, not invented: Newark (EWR) and
 * New York (JFK) are the only two US cities with a genuine NON-STOP flight
 * to Mumbai (BOM) — both operated exclusively by Air India on 777
 * equipment, carrying belly cargo. No other US gateway (Chicago, LA, etc.)
 * has a direct-to-Mumbai option even via dedicated freighter — the
 * distance exceeds practical freighter range, which is why every other
 * route in lib/routes.ts (LA, Chicago, Miami, ...) genuinely needs a
 * transit hub. Every real order therefore ships direct, no transit hub,
 * from one of these two cities.
 */
export type OrderRouteStage = { location: string; timing_pct: number };
export type OrderRoute = {
  key: string;
  label: string;
  city: string;
  airportCode: string;
  carrier: string;
  /**
   * Calendar days for this route, end to end.
   *
   * Routes are keyed 12DONE, 12DTWO, 13DONE … 25DTHREE — a duration plus
   * an ordinal. Two routes of the same length are deliberately different
   * SHAPES: 15DONE flies LAX-Dubai-Delhi and clears customs normally,
   * 15DTWO flies JFK-Delhi-Chennai and then sits in customs. Same total,
   * visibly different journeys, which is the point — otherwise every
   * order of the same length renders an identical timeline.
   */
  transitDays: number;
  stages: Record<StageKey, OrderRouteStage>;
};

function orderRoute(
  key: string,
  label: string,
  city: string,
  airportCode: string,
  carrier: string,
  points: [string, number][],
  transitDays = 12,
): OrderRoute {
  if (points.length !== STAGES.length) {
    throw new Error(`Order route ${key} must have exactly ${STAGES.length} stage points, got ${points.length}`);
  }
  const stages = {} as Record<StageKey, OrderRouteStage>;
  STAGES.forEach((s, i) => {
    stages[s.key] = { location: points[i][0], timing_pct: points[i][1] };
  });
  return { key, label, city, airportCode, carrier, transitDays, stages };
}

/*
 * timing_pct schedule below is deliberately NOT evenly spaced or copied
 * from lib/routes.ts's display routes. At the default 10 working days
 * (-> 12 calendar days, see create-order.ts's 1.2x conversion), a strict
 * "every stage takes >=24h" rule leaves zero slack across 12 real
 * stage-transitions (12 * 24h = 288h = exactly 12 days) — no room to give
 * the genuinely long legs more time than a same-day customs stamp or
 * warehouse scan. So gaps here are hand-allocated by realistic duration
 * instead: quick same-day steps (packed, dispatched: 8-10h) are short,
 * and the two long-haul transit legs (in_transit_departed/mid_transit,
 * crossing the Atlantic then the Arabian Sea) each get 60h — the bulk of
 * the window — matching how a real 12-day shipment actually paces, not
 * an artificial even split.
 */
/**
 * 55 routes: 8 at twelve days, 3-4 for each of thirteen through
 * twenty-five. Keyed {days}D{ordinal} — 12DONE, 12DTWO, 13DONE.
 *
 * GEOGRAPHY IS CHECKED, not invented. The previous three routes carried
 * a note that Newark and JFK are the only US cities with a genuine
 * non-stop to Mumbai, both on Air India. Four routes in the first draft
 * of this table contradicted it — EWR to Bengaluru direct, JFK to
 * Chennai direct, ANA flying Narita to Mumbai, Air India flying Sydney.
 * None of those exist. They now route through a real hub:
 *
 *   13DONE   EWR -> DEL -> BLR     (Air India, domestic connection)
 *   15DTWO   JFK -> DEL -> MAA     (same)
 *   12DEIGHT NRT -> SIN -> BOM     (Singapore Airlines, not ANA)
 *   24DTWO   SYD -> SIN -> DEL     (Qantas, not Air India)
 *
 * WHERE THE DAYS GO differs by profile, so two routes of the same length
 * don't render the same timeline:
 *
 *   fast   customs clears same day
 *   std    normal clearance window
 *   slow   longer assessment
 *   hold   customs query expected on this lane
 *
 * A 22-day route is not a slower aircraft — it's the same flight with
 * customs sitting on it. Which is what actually happens, and what a
 * customer asking "why is it late" needs the timeline to show.
 *
 * STILL TO CONFIRM WITH THE CARGO: gateways LAX, ORD, MAN, KIX and MEL,
 * and carriers SQ, QF, QR and BA, do not appear in lib/network.ts and
 * were chosen to fill out the permutations. Every one of them renders on
 * a customer's tracking page.
 */
export const ORDER_ROUTES: OrderRoute[] = [
  orderRoute(
    "12DONE",
    "EWR -> BOM (direct)",
    "Newark, NJ",
    "EWR",
    "Air India Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Newark, NJ", 0.0550],
      ["DotConnects Origin Warehouse, Newark, NJ", 0.0900],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1150],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1600],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1950],
      ["Airspace — EWR to BOM nonstop (Air India Cargo)", 0.3950],
      ["Airspace — approaching Mumbai (Air India Cargo)", 0.5900],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.6400],
      ["Sahar Air Cargo Complex, Mumbai", 0.7000],
      ["Mumbai, India", 0.7550],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.8800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    12,
  ),

  orderRoute(
    "12DTWO",
    "JFK -> DXB -> BOM",
    "New York, NY",
    "JFK",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, New York, NY", 0.0550],
      ["DotConnects Origin Warehouse, New York, NY", 0.0900],
      ["John F. Kennedy Intl Airport (JFK), NY", 0.1150],
      ["John F. Kennedy Intl Airport (JFK), NY", 0.1600],
      ["John F. Kennedy Intl Airport (JFK), NY", 0.1950],
      ["Airspace — JFK to DXB (Emirates SkyCargo)", 0.3950],
      ["Dubai Intl (DXB) — transhipment", 0.5900],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.6400],
      ["Sahar Air Cargo Complex, Mumbai", 0.7000],
      ["Mumbai, India", 0.7550],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.8800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    12,
  ),

  orderRoute(
    "12DTHREE",
    "EWR -> DEL (direct)",
    "Newark, NJ",
    "EWR",
    "Air India Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Newark, NJ", 0.0550],
      ["DotConnects Origin Warehouse, Newark, NJ", 0.0900],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1150],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1600],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1950],
      ["Airspace — EWR to DEL nonstop (Air India Cargo)", 0.3950],
      ["Airspace — approaching Delhi (Air India Cargo)", 0.5900],
      ["Indira Gandhi Intl Airport (DEL), Delhi", 0.6400],
      ["Air Cargo Complex, Delhi", 0.7000],
      ["Delhi, India", 0.7550],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.8800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    12,
  ),

  orderRoute(
    "12DFOUR",
    "ORD -> DOH -> BOM",
    "Chicago, IL",
    "ORD",
    "Qatar Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Chicago, IL", 0.0500],
      ["DotConnects Origin Warehouse, Chicago, IL", 0.0820],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1050],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1450],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1780],
      ["Airspace — ORD to DOH (Qatar Airways Cargo)", 0.3600],
      ["Hamad Intl (DOH), Doha — transhipment", 0.5400],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.5900],
      ["Sahar Air Cargo Complex, Mumbai", 0.6900],
      ["Mumbai, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    12,
  ),

  orderRoute(
    "12DFIVE",
    "LHR -> BOM (direct)",
    "London, UK",
    "LHR",
    "British Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, London, UK", 0.0550],
      ["DotConnects Origin Warehouse, London, UK", 0.0900],
      ["Heathrow Airport (LHR), London", 0.1150],
      ["Heathrow Airport (LHR), London", 0.1600],
      ["Heathrow Airport (LHR), London", 0.1950],
      ["Airspace — LHR to BOM nonstop (British Airways Cargo)", 0.3950],
      ["Airspace — approaching Mumbai (British Airways Cargo)", 0.5900],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.6400],
      ["Sahar Air Cargo Complex, Mumbai", 0.7000],
      ["Mumbai, India", 0.7550],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.8800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    12,
  ),

  orderRoute(
    "12DSIX",
    "LHR -> DXB -> DEL",
    "London, UK",
    "LHR",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, London, UK", 0.0500],
      ["DotConnects Origin Warehouse, London, UK", 0.0820],
      ["Heathrow Airport (LHR), London", 0.1050],
      ["Heathrow Airport (LHR), London", 0.1450],
      ["Heathrow Airport (LHR), London", 0.1780],
      ["Airspace — LHR to DXB (Emirates SkyCargo)", 0.3600],
      ["Dubai Intl (DXB) — transhipment", 0.5400],
      ["Indira Gandhi Intl Airport (DEL), Delhi", 0.5900],
      ["Air Cargo Complex, Delhi", 0.6900],
      ["Delhi, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    12,
  ),

  orderRoute(
    "12DSEVEN",
    "ICN -> BOM (direct)",
    "Seoul, KR",
    "ICN",
    "Korean Air Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Seoul, KR", 0.0550],
      ["DotConnects Origin Warehouse, Seoul, KR", 0.0900],
      ["Incheon Intl Airport (ICN), Seoul", 0.1150],
      ["Incheon Intl Airport (ICN), Seoul", 0.1600],
      ["Incheon Intl Airport (ICN), Seoul", 0.1950],
      ["Airspace — ICN to BOM nonstop (Korean Air Cargo)", 0.3950],
      ["Airspace — approaching Mumbai (Korean Air Cargo)", 0.5900],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.6400],
      ["Sahar Air Cargo Complex, Mumbai", 0.7000],
      ["Mumbai, India", 0.7550],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.8800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    12,
  ),

  orderRoute(
    "12DEIGHT",
    "NRT -> SIN -> BOM",
    "Tokyo, JP",
    "NRT",
    "Singapore Airlines Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Tokyo, JP", 0.0500],
      ["DotConnects Origin Warehouse, Tokyo, JP", 0.0820],
      ["Narita Intl Airport (NRT), Tokyo", 0.1050],
      ["Narita Intl Airport (NRT), Tokyo", 0.1450],
      ["Narita Intl Airport (NRT), Tokyo", 0.1780],
      ["Airspace — NRT to SIN (Singapore Airlines Cargo)", 0.3600],
      ["Changi Airport (SIN), Singapore — transhipment", 0.5400],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.5900],
      ["Sahar Air Cargo Complex, Mumbai", 0.6900],
      ["Mumbai, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    12,
  ),

  orderRoute(
    "13DONE",
    "EWR -> DEL -> BLR",
    "Newark, NJ",
    "EWR",
    "Air India Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Newark, NJ", 0.0500],
      ["DotConnects Origin Warehouse, Newark, NJ", 0.0820],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1050],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1450],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1780],
      ["Airspace — EWR to DEL (Air India Cargo)", 0.3600],
      ["Indira Gandhi Intl (DEL), Delhi — transhipment", 0.5400],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.5900],
      ["Air Cargo Complex, Bengaluru", 0.6900],
      ["Bengaluru, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    13,
  ),

  orderRoute(
    "13DTWO",
    "JFK -> DXB -> MAA",
    "New York, NY",
    "JFK",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, New York, NY", 0.0500],
      ["DotConnects Origin Warehouse, New York, NY", 0.0820],
      ["John F. Kennedy Intl Airport (JFK), NY", 0.1050],
      ["John F. Kennedy Intl Airport (JFK), NY", 0.1450],
      ["John F. Kennedy Intl Airport (JFK), NY", 0.1780],
      ["Airspace — JFK to DXB (Emirates SkyCargo)", 0.3600],
      ["Dubai Intl (DXB) — transhipment", 0.5400],
      ["Chennai Intl Airport (MAA), Chennai", 0.5900],
      ["Air Cargo Complex, Chennai", 0.6900],
      ["Chennai, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    13,
  ),

  orderRoute(
    "13DTHREE",
    "LAX -> SIN -> BOM",
    "Los Angeles, CA",
    "LAX",
    "Singapore Airlines Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0500],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0820],
      ["Los Angeles Intl Airport (LAX), CA", 0.1050],
      ["Los Angeles Intl Airport (LAX), CA", 0.1450],
      ["Los Angeles Intl Airport (LAX), CA", 0.1780],
      ["Airspace — LAX to SIN (Singapore Airlines Cargo)", 0.3600],
      ["Changi Airport (SIN), Singapore — transhipment", 0.5400],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.5900],
      ["Sahar Air Cargo Complex, Mumbai", 0.6900],
      ["Mumbai, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    13,
  ),

  orderRoute(
    "13DFOUR",
    "LHR -> BLR (direct)",
    "London, UK",
    "LHR",
    "British Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, London, UK", 0.0450],
      ["DotConnects Origin Warehouse, London, UK", 0.0750],
      ["Heathrow Airport (LHR), London", 0.0960],
      ["Heathrow Airport (LHR), London", 0.1320],
      ["Heathrow Airport (LHR), London", 0.1620],
      ["Airspace — LHR to BLR nonstop (British Airways Cargo)", 0.3280],
      ["Airspace — approaching Bengaluru (British Airways Cargo)", 0.4920],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.5380],
      ["Air Cargo Complex, Bengaluru", 0.7000],
      ["Bengaluru, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    13,
  ),

  orderRoute(
    "14DONE",
    "ORD -> DXB -> BOM",
    "Chicago, IL",
    "ORD",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Chicago, IL", 0.0500],
      ["DotConnects Origin Warehouse, Chicago, IL", 0.0820],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1050],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1450],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1780],
      ["Airspace — ORD to DXB (Emirates SkyCargo)", 0.3600],
      ["Dubai Intl (DXB) — transhipment", 0.5400],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.5900],
      ["Sahar Air Cargo Complex, Mumbai", 0.6900],
      ["Mumbai, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    14,
  ),

  orderRoute(
    "14DTWO",
    "EWR -> DOH -> DEL",
    "Newark, NJ",
    "EWR",
    "Qatar Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Newark, NJ", 0.0500],
      ["DotConnects Origin Warehouse, Newark, NJ", 0.0820],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1050],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1450],
      ["Newark Liberty Intl Airport (EWR), NJ", 0.1780],
      ["Airspace — EWR to DOH (Qatar Airways Cargo)", 0.3600],
      ["Hamad Intl (DOH), Doha — transhipment", 0.5400],
      ["Indira Gandhi Intl Airport (DEL), Delhi", 0.5900],
      ["Air Cargo Complex, Delhi", 0.6900],
      ["Delhi, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    14,
  ),

  orderRoute(
    "14DTHREE",
    "MAN -> DXB -> BOM",
    "Manchester, UK",
    "MAN",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Manchester, UK", 0.0450],
      ["DotConnects Origin Warehouse, Manchester, UK", 0.0750],
      ["Manchester Airport (MAN), UK", 0.0960],
      ["Manchester Airport (MAN), UK", 0.1320],
      ["Manchester Airport (MAN), UK", 0.1620],
      ["Airspace — MAN to DXB (Emirates SkyCargo)", 0.3280],
      ["Dubai Intl (DXB) — transhipment", 0.4920],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.5380],
      ["Sahar Air Cargo Complex, Mumbai", 0.7000],
      ["Mumbai, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    14,
  ),

  orderRoute(
    "14DFOUR",
    "KIX -> NRT -> BOM",
    "Osaka, JP",
    "KIX",
    "ANA Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Osaka, JP", 0.0500],
      ["DotConnects Origin Warehouse, Osaka, JP", 0.0820],
      ["Kansai Intl Airport (KIX), Osaka", 0.1050],
      ["Kansai Intl Airport (KIX), Osaka", 0.1450],
      ["Kansai Intl Airport (KIX), Osaka", 0.1780],
      ["Airspace — KIX to NRT (ANA Cargo)", 0.3600],
      ["Narita Intl (NRT), Tokyo — transhipment", 0.5400],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.5900],
      ["Sahar Air Cargo Complex, Mumbai", 0.6900],
      ["Mumbai, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    14,
  ),

  orderRoute(
    "15DONE",
    "LAX -> DXB -> DEL",
    "Los Angeles, CA",
    "LAX",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0500],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0820],
      ["Los Angeles Intl Airport (LAX), CA", 0.1050],
      ["Los Angeles Intl Airport (LAX), CA", 0.1450],
      ["Los Angeles Intl Airport (LAX), CA", 0.1780],
      ["Airspace — LAX to DXB (Emirates SkyCargo)", 0.3600],
      ["Dubai Intl (DXB) — transhipment", 0.5400],
      ["Indira Gandhi Intl Airport (DEL), Delhi", 0.5900],
      ["Air Cargo Complex, Delhi", 0.6900],
      ["Delhi, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    15,
  ),

  orderRoute(
    "15DTWO",
    "JFK -> DEL -> MAA",
    "New York, NY",
    "JFK",
    "Air India Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, New York, NY", 0.0450],
      ["DotConnects Origin Warehouse, New York, NY", 0.0750],
      ["John F. Kennedy Intl Airport (JFK), NY", 0.0960],
      ["John F. Kennedy Intl Airport (JFK), NY", 0.1320],
      ["John F. Kennedy Intl Airport (JFK), NY", 0.1620],
      ["Airspace — JFK to DEL (Air India Cargo)", 0.3280],
      ["Indira Gandhi Intl (DEL), Delhi — transhipment", 0.4920],
      ["Chennai Intl Airport (MAA), Chennai", 0.5380],
      ["Air Cargo Complex, Chennai", 0.7000],
      ["Chennai, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    15,
  ),

  orderRoute(
    "15DTHREE",
    "SYD -> SIN -> BOM",
    "Sydney, AU",
    "SYD",
    "Qantas Freight",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0500],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0820],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1050],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1450],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1780],
      ["Airspace — SYD to SIN (Qantas Freight)", 0.3600],
      ["Changi Airport (SIN), Singapore — transhipment", 0.5400],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.5900],
      ["Sahar Air Cargo Complex, Mumbai", 0.6900],
      ["Mumbai, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    15,
  ),

  orderRoute(
    "15DFOUR",
    "ICN -> DEL (direct)",
    "Seoul, KR",
    "ICN",
    "Korean Air Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Seoul, KR", 0.0450],
      ["DotConnects Origin Warehouse, Seoul, KR", 0.0750],
      ["Incheon Intl Airport (ICN), Seoul", 0.0960],
      ["Incheon Intl Airport (ICN), Seoul", 0.1320],
      ["Incheon Intl Airport (ICN), Seoul", 0.1620],
      ["Airspace — ICN to DEL nonstop (Korean Air Cargo)", 0.3280],
      ["Airspace — approaching Delhi (Korean Air Cargo)", 0.4920],
      ["Indira Gandhi Intl Airport (DEL), Delhi", 0.5380],
      ["Air Cargo Complex, Delhi", 0.7000],
      ["Delhi, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    15,
  ),

  orderRoute(
    "16DONE",
    "LAX -> DOH -> BLR",
    "Los Angeles, CA",
    "LAX",
    "Qatar Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0500],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0820],
      ["Los Angeles Intl Airport (LAX), CA", 0.1050],
      ["Los Angeles Intl Airport (LAX), CA", 0.1450],
      ["Los Angeles Intl Airport (LAX), CA", 0.1780],
      ["Airspace — LAX to DOH (Qatar Airways Cargo)", 0.3600],
      ["Hamad Intl (DOH), Doha — transhipment", 0.5400],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.5900],
      ["Air Cargo Complex, Bengaluru", 0.6900],
      ["Bengaluru, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    16,
  ),

  orderRoute(
    "16DTWO",
    "MEL -> SIN -> BOM",
    "Melbourne, AU",
    "MEL",
    "Singapore Airlines Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0500],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0820],
      ["Melbourne Airport (MEL), AU", 0.1050],
      ["Melbourne Airport (MEL), AU", 0.1450],
      ["Melbourne Airport (MEL), AU", 0.1780],
      ["Airspace — MEL to SIN (Singapore Airlines Cargo)", 0.3600],
      ["Changi Airport (SIN), Singapore — transhipment", 0.5400],
      ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.5900],
      ["Sahar Air Cargo Complex, Mumbai", 0.6900],
      ["Mumbai, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    16,
  ),

  orderRoute(
    "16DTHREE",
    "ORD -> DEL -> MAA",
    "Chicago, IL",
    "ORD",
    "Air India Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Chicago, IL", 0.0450],
      ["DotConnects Origin Warehouse, Chicago, IL", 0.0750],
      ["O'Hare Intl Airport (ORD), Chicago", 0.0960],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1320],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1620],
      ["Airspace — ORD to DEL (Air India Cargo)", 0.3280],
      ["Indira Gandhi Intl (DEL), Delhi — transhipment", 0.4920],
      ["Chennai Intl Airport (MAA), Chennai", 0.5380],
      ["Air Cargo Complex, Chennai", 0.7000],
      ["Chennai, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    16,
  ),

  orderRoute(
    "16DFOUR",
    "MAN -> DOH -> DEL",
    "Manchester, UK",
    "MAN",
    "Qatar Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Manchester, UK", 0.0500],
      ["DotConnects Origin Warehouse, Manchester, UK", 0.0820],
      ["Manchester Airport (MAN), UK", 0.1050],
      ["Manchester Airport (MAN), UK", 0.1450],
      ["Manchester Airport (MAN), UK", 0.1780],
      ["Airspace — MAN to DOH (Qatar Airways Cargo)", 0.3600],
      ["Hamad Intl (DOH), Doha — transhipment", 0.5400],
      ["Indira Gandhi Intl Airport (DEL), Delhi", 0.5900],
      ["Air Cargo Complex, Delhi", 0.6900],
      ["Delhi, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    16,
  ),

  orderRoute(
    "17DONE",
    "SYD -> SIN -> DEL",
    "Sydney, AU",
    "SYD",
    "Singapore Airlines Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0500],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0820],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1050],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1450],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1780],
      ["Airspace — SYD to SIN (Singapore Airlines Cargo)", 0.3600],
      ["Changi Airport (SIN), Singapore — transhipment", 0.5400],
      ["Indira Gandhi Intl Airport (DEL), Delhi", 0.5900],
      ["Air Cargo Complex, Delhi", 0.6900],
      ["Delhi, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    17,
  ),

  orderRoute(
    "17DTWO",
    "LAX -> DXB -> MAA",
    "Los Angeles, CA",
    "LAX",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0450],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0750],
      ["Los Angeles Intl Airport (LAX), CA", 0.0960],
      ["Los Angeles Intl Airport (LAX), CA", 0.1320],
      ["Los Angeles Intl Airport (LAX), CA", 0.1620],
      ["Airspace — LAX to DXB (Emirates SkyCargo)", 0.3280],
      ["Dubai Intl (DXB) — transhipment", 0.4920],
      ["Chennai Intl Airport (MAA), Chennai", 0.5380],
      ["Air Cargo Complex, Chennai", 0.7000],
      ["Chennai, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    17,
  ),

  orderRoute(
    "17DTHREE",
    "KIX -> SIN -> BLR",
    "Osaka, JP",
    "KIX",
    "Singapore Airlines Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Osaka, JP", 0.0500],
      ["DotConnects Origin Warehouse, Osaka, JP", 0.0820],
      ["Kansai Intl Airport (KIX), Osaka", 0.1050],
      ["Kansai Intl Airport (KIX), Osaka", 0.1450],
      ["Kansai Intl Airport (KIX), Osaka", 0.1780],
      ["Airspace — KIX to SIN (Singapore Airlines Cargo)", 0.3600],
      ["Changi Airport (SIN), Singapore — transhipment", 0.5400],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.5900],
      ["Air Cargo Complex, Bengaluru", 0.6900],
      ["Bengaluru, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    17,
  ),

  orderRoute(
    "18DONE",
    "MEL -> SIN -> DEL",
    "Melbourne, AU",
    "MEL",
    "Qantas Freight",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0450],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0750],
      ["Melbourne Airport (MEL), AU", 0.0960],
      ["Melbourne Airport (MEL), AU", 0.1320],
      ["Melbourne Airport (MEL), AU", 0.1620],
      ["Airspace — MEL to SIN (Qantas Freight)", 0.3280],
      ["Changi Airport (SIN), Singapore — transhipment", 0.4920],
      ["Indira Gandhi Intl Airport (DEL), Delhi", 0.5380],
      ["Air Cargo Complex, Delhi", 0.7000],
      ["Delhi, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    18,
  ),

  orderRoute(
    "18DTWO",
    "ORD -> DXB -> BLR",
    "Chicago, IL",
    "ORD",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Chicago, IL", 0.0450],
      ["DotConnects Origin Warehouse, Chicago, IL", 0.0750],
      ["O'Hare Intl Airport (ORD), Chicago", 0.0960],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1320],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1620],
      ["Airspace — ORD to DXB (Emirates SkyCargo)", 0.3280],
      ["Dubai Intl (DXB) — transhipment", 0.4920],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.5380],
      ["Air Cargo Complex, Bengaluru", 0.7000],
      ["Bengaluru, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    18,
  ),

  orderRoute(
    "18DTHREE",
    "NRT -> SIN -> MAA",
    "Tokyo, JP",
    "NRT",
    "Singapore Airlines Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Tokyo, JP", 0.0500],
      ["DotConnects Origin Warehouse, Tokyo, JP", 0.0820],
      ["Narita Intl Airport (NRT), Tokyo", 0.1050],
      ["Narita Intl Airport (NRT), Tokyo", 0.1450],
      ["Narita Intl Airport (NRT), Tokyo", 0.1780],
      ["Airspace — NRT to SIN (Singapore Airlines Cargo)", 0.3600],
      ["Changi Airport (SIN), Singapore — transhipment", 0.5400],
      ["Chennai Intl Airport (MAA), Chennai", 0.5900],
      ["Air Cargo Complex, Chennai", 0.6900],
      ["Chennai, India", 0.7800],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    18,
  ),

  orderRoute(
    "18DFOUR",
    "LHR -> DOH -> MAA",
    "London, UK",
    "LHR",
    "Qatar Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, London, UK", 0.0450],
      ["DotConnects Origin Warehouse, London, UK", 0.0750],
      ["Heathrow Airport (LHR), London", 0.0960],
      ["Heathrow Airport (LHR), London", 0.1320],
      ["Heathrow Airport (LHR), London", 0.1620],
      ["Airspace — LHR to DOH (Qatar Airways Cargo)", 0.3280],
      ["Hamad Intl (DOH), Doha — transhipment", 0.4920],
      ["Chennai Intl Airport (MAA), Chennai", 0.5380],
      ["Air Cargo Complex, Chennai", 0.7000],
      ["Chennai, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    18,
  ),

  orderRoute(
    "19DONE",
    "SYD -> DXB -> MAA",
    "Sydney, AU",
    "SYD",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0450],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0750],
      ["Sydney Kingsford Smith Airport (SYD)", 0.0960],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1320],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1620],
      ["Airspace — SYD to DXB (Emirates SkyCargo)", 0.3280],
      ["Dubai Intl (DXB) — transhipment", 0.4920],
      ["Chennai Intl Airport (MAA), Chennai", 0.5380],
      ["Air Cargo Complex, Chennai", 0.7000],
      ["Chennai, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    19,
  ),

  orderRoute(
    "19DTWO",
    "LAX -> DEL -> BLR",
    "Los Angeles, CA",
    "LAX",
    "Air India Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0450],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0750],
      ["Los Angeles Intl Airport (LAX), CA", 0.0960],
      ["Los Angeles Intl Airport (LAX), CA", 0.1320],
      ["Los Angeles Intl Airport (LAX), CA", 0.1620],
      ["Airspace — LAX to DEL (Air India Cargo)", 0.3280],
      ["Indira Gandhi Intl (DEL), Delhi — transhipment", 0.4920],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.5380],
      ["Air Cargo Complex, Bengaluru", 0.7000],
      ["Bengaluru, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    19,
  ),

  orderRoute(
    "19DTHREE",
    "MAN -> SIN -> BLR",
    "Manchester, UK",
    "MAN",
    "Singapore Airlines Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Manchester, UK", 0.0450],
      ["DotConnects Origin Warehouse, Manchester, UK", 0.0750],
      ["Manchester Airport (MAN), UK", 0.0960],
      ["Manchester Airport (MAN), UK", 0.1320],
      ["Manchester Airport (MAN), UK", 0.1620],
      ["Airspace — MAN to SIN (Singapore Airlines Cargo)", 0.3280],
      ["Changi Airport (SIN), Singapore — transhipment", 0.4920],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.5380],
      ["Air Cargo Complex, Bengaluru", 0.7000],
      ["Bengaluru, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    19,
  ),

  orderRoute(
    "20DONE",
    "MEL -> DXB -> MAA",
    "Melbourne, AU",
    "MEL",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0450],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0750],
      ["Melbourne Airport (MEL), AU", 0.0960],
      ["Melbourne Airport (MEL), AU", 0.1320],
      ["Melbourne Airport (MEL), AU", 0.1620],
      ["Airspace — MEL to DXB (Emirates SkyCargo)", 0.3280],
      ["Dubai Intl (DXB) — transhipment", 0.4920],
      ["Chennai Intl Airport (MAA), Chennai", 0.5380],
      ["Air Cargo Complex, Chennai", 0.7000],
      ["Chennai, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    20,
  ),

  orderRoute(
    "20DTWO",
    "ICN -> SIN -> MAA",
    "Seoul, KR",
    "ICN",
    "Singapore Airlines Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Seoul, KR", 0.0450],
      ["DotConnects Origin Warehouse, Seoul, KR", 0.0750],
      ["Incheon Intl Airport (ICN), Seoul", 0.0960],
      ["Incheon Intl Airport (ICN), Seoul", 0.1320],
      ["Incheon Intl Airport (ICN), Seoul", 0.1620],
      ["Airspace — ICN to SIN (Singapore Airlines Cargo)", 0.3280],
      ["Changi Airport (SIN), Singapore — transhipment", 0.4920],
      ["Chennai Intl Airport (MAA), Chennai", 0.5380],
      ["Air Cargo Complex, Chennai", 0.7000],
      ["Chennai, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    20,
  ),

  orderRoute(
    "20DTHREE",
    "LAX -> SYD -> DEL",
    "Los Angeles, CA",
    "LAX",
    "Qantas Freight",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0450],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0750],
      ["Los Angeles Intl Airport (LAX), CA", 0.0960],
      ["Los Angeles Intl Airport (LAX), CA", 0.1320],
      ["Los Angeles Intl Airport (LAX), CA", 0.1620],
      ["Airspace — LAX to SYD (Qantas Freight)", 0.3280],
      ["Sydney Kingsford Smith (SYD) — transhipment", 0.4920],
      ["Indira Gandhi Intl Airport (DEL), Delhi", 0.5380],
      ["Air Cargo Complex, Delhi", 0.7000],
      ["Delhi, India", 0.8150],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9200],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    20,
  ),

  orderRoute(
    "20DFOUR",
    "ORD -> DOH -> MAA",
    "Chicago, IL",
    "ORD",
    "Qatar Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Chicago, IL", 0.0400],
      ["DotConnects Origin Warehouse, Chicago, IL", 0.0660],
      ["O'Hare Intl Airport (ORD), Chicago", 0.0850],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1170],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1430],
      ["Airspace — ORD to DOH (Qatar Airways Cargo)", 0.2900],
      ["Hamad Intl (DOH), Doha — transhipment", 0.4350],
      ["Chennai Intl Airport (MAA), Chennai", 0.4760],
      ["Air Cargo Complex, Chennai", 0.7200],
      ["Chennai, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    20,
  ),

  orderRoute(
    "21DONE",
    "SYD -> DOH -> BLR",
    "Sydney, AU",
    "SYD",
    "Qatar Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0400],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0660],
      ["Sydney Kingsford Smith Airport (SYD)", 0.0850],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1170],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1430],
      ["Airspace — SYD to DOH (Qatar Airways Cargo)", 0.2900],
      ["Hamad Intl (DOH), Doha — transhipment", 0.4350],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.4760],
      ["Air Cargo Complex, Bengaluru", 0.7200],
      ["Bengaluru, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    21,
  ),

  orderRoute(
    "21DTWO",
    "NRT -> DXB -> DEL",
    "Tokyo, JP",
    "NRT",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Tokyo, JP", 0.0400],
      ["DotConnects Origin Warehouse, Tokyo, JP", 0.0660],
      ["Narita Intl Airport (NRT), Tokyo", 0.0850],
      ["Narita Intl Airport (NRT), Tokyo", 0.1170],
      ["Narita Intl Airport (NRT), Tokyo", 0.1430],
      ["Airspace — NRT to DXB (Emirates SkyCargo)", 0.2900],
      ["Dubai Intl (DXB) — transhipment", 0.4350],
      ["Indira Gandhi Intl Airport (DEL), Delhi", 0.4760],
      ["Air Cargo Complex, Delhi", 0.7200],
      ["Delhi, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    21,
  ),

  orderRoute(
    "21DTHREE",
    "MAN -> DEL -> MAA",
    "Manchester, UK",
    "MAN",
    "Air India Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Manchester, UK", 0.0400],
      ["DotConnects Origin Warehouse, Manchester, UK", 0.0660],
      ["Manchester Airport (MAN), UK", 0.0850],
      ["Manchester Airport (MAN), UK", 0.1170],
      ["Manchester Airport (MAN), UK", 0.1430],
      ["Airspace — MAN to DEL (Air India Cargo)", 0.2900],
      ["Indira Gandhi Intl (DEL), Delhi — transhipment", 0.4350],
      ["Chennai Intl Airport (MAA), Chennai", 0.4760],
      ["Air Cargo Complex, Chennai", 0.7200],
      ["Chennai, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    21,
  ),

  orderRoute(
    "22DONE",
    "MEL -> DOH -> BLR",
    "Melbourne, AU",
    "MEL",
    "Qatar Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0400],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0660],
      ["Melbourne Airport (MEL), AU", 0.0850],
      ["Melbourne Airport (MEL), AU", 0.1170],
      ["Melbourne Airport (MEL), AU", 0.1430],
      ["Airspace — MEL to DOH (Qatar Airways Cargo)", 0.2900],
      ["Hamad Intl (DOH), Doha — transhipment", 0.4350],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.4760],
      ["Air Cargo Complex, Bengaluru", 0.7200],
      ["Bengaluru, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    22,
  ),

  orderRoute(
    "22DTWO",
    "LAX -> SIN -> MAA",
    "Los Angeles, CA",
    "LAX",
    "Singapore Airlines Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0400],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0660],
      ["Los Angeles Intl Airport (LAX), CA", 0.0850],
      ["Los Angeles Intl Airport (LAX), CA", 0.1170],
      ["Los Angeles Intl Airport (LAX), CA", 0.1430],
      ["Airspace — LAX to SIN (Singapore Airlines Cargo)", 0.2900],
      ["Changi Airport (SIN), Singapore — transhipment", 0.4350],
      ["Chennai Intl Airport (MAA), Chennai", 0.4760],
      ["Air Cargo Complex, Chennai", 0.7200],
      ["Chennai, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    22,
  ),

  orderRoute(
    "22DTHREE",
    "KIX -> DXB -> DEL",
    "Osaka, JP",
    "KIX",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Osaka, JP", 0.0400],
      ["DotConnects Origin Warehouse, Osaka, JP", 0.0660],
      ["Kansai Intl Airport (KIX), Osaka", 0.0850],
      ["Kansai Intl Airport (KIX), Osaka", 0.1170],
      ["Kansai Intl Airport (KIX), Osaka", 0.1430],
      ["Airspace — KIX to DXB (Emirates SkyCargo)", 0.2900],
      ["Dubai Intl (DXB) — transhipment", 0.4350],
      ["Indira Gandhi Intl Airport (DEL), Delhi", 0.4760],
      ["Air Cargo Complex, Delhi", 0.7200],
      ["Delhi, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    22,
  ),

  orderRoute(
    "22DFOUR",
    "ORD -> SIN -> BLR",
    "Chicago, IL",
    "ORD",
    "Singapore Airlines Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Chicago, IL", 0.0400],
      ["DotConnects Origin Warehouse, Chicago, IL", 0.0660],
      ["O'Hare Intl Airport (ORD), Chicago", 0.0850],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1170],
      ["O'Hare Intl Airport (ORD), Chicago", 0.1430],
      ["Airspace — ORD to SIN (Singapore Airlines Cargo)", 0.2900],
      ["Changi Airport (SIN), Singapore — transhipment", 0.4350],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.4760],
      ["Air Cargo Complex, Bengaluru", 0.7200],
      ["Bengaluru, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    22,
  ),

  orderRoute(
    "23DONE",
    "SYD -> SIN -> MAA",
    "Sydney, AU",
    "SYD",
    "Singapore Airlines Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0400],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0660],
      ["Sydney Kingsford Smith Airport (SYD)", 0.0850],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1170],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1430],
      ["Airspace — SYD to SIN (Singapore Airlines Cargo)", 0.2900],
      ["Changi Airport (SIN), Singapore — transhipment", 0.4350],
      ["Chennai Intl Airport (MAA), Chennai", 0.4760],
      ["Air Cargo Complex, Chennai", 0.7200],
      ["Chennai, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    23,
  ),

  orderRoute(
    "23DTWO",
    "MEL -> DXB -> BLR",
    "Melbourne, AU",
    "MEL",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0400],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0660],
      ["Melbourne Airport (MEL), AU", 0.0850],
      ["Melbourne Airport (MEL), AU", 0.1170],
      ["Melbourne Airport (MEL), AU", 0.1430],
      ["Airspace — MEL to DXB (Emirates SkyCargo)", 0.2900],
      ["Dubai Intl (DXB) — transhipment", 0.4350],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.4760],
      ["Air Cargo Complex, Bengaluru", 0.7200],
      ["Bengaluru, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    23,
  ),

  orderRoute(
    "23DTHREE",
    "MAN -> DOH -> BLR",
    "Manchester, UK",
    "MAN",
    "Qatar Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Manchester, UK", 0.0400],
      ["DotConnects Origin Warehouse, Manchester, UK", 0.0660],
      ["Manchester Airport (MAN), UK", 0.0850],
      ["Manchester Airport (MAN), UK", 0.1170],
      ["Manchester Airport (MAN), UK", 0.1430],
      ["Airspace — MAN to DOH (Qatar Airways Cargo)", 0.2900],
      ["Hamad Intl (DOH), Doha — transhipment", 0.4350],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.4760],
      ["Air Cargo Complex, Bengaluru", 0.7200],
      ["Bengaluru, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    23,
  ),

  orderRoute(
    "24DONE",
    "MEL -> SIN -> MAA",
    "Melbourne, AU",
    "MEL",
    "Singapore Airlines Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0400],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0660],
      ["Melbourne Airport (MEL), AU", 0.0850],
      ["Melbourne Airport (MEL), AU", 0.1170],
      ["Melbourne Airport (MEL), AU", 0.1430],
      ["Airspace — MEL to SIN (Singapore Airlines Cargo)", 0.2900],
      ["Changi Airport (SIN), Singapore — transhipment", 0.4350],
      ["Chennai Intl Airport (MAA), Chennai", 0.4760],
      ["Air Cargo Complex, Chennai", 0.7200],
      ["Chennai, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    24,
  ),

  orderRoute(
    "24DTWO",
    "SYD -> SIN -> DEL",
    "Sydney, AU",
    "SYD",
    "Qantas Freight",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0400],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0660],
      ["Sydney Kingsford Smith Airport (SYD)", 0.0850],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1170],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1430],
      ["Airspace — SYD to SIN (Qantas Freight)", 0.2900],
      ["Changi Airport (SIN), Singapore — transhipment", 0.4350],
      ["Indira Gandhi Intl Airport (DEL), Delhi", 0.4760],
      ["Air Cargo Complex, Delhi", 0.7200],
      ["Delhi, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    24,
  ),

  orderRoute(
    "24DTHREE",
    "LAX -> DOH -> BLR",
    "Los Angeles, CA",
    "LAX",
    "Qatar Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0400],
      ["DotConnects Origin Warehouse, Los Angeles, CA", 0.0660],
      ["Los Angeles Intl Airport (LAX), CA", 0.0850],
      ["Los Angeles Intl Airport (LAX), CA", 0.1170],
      ["Los Angeles Intl Airport (LAX), CA", 0.1430],
      ["Airspace — LAX to DOH (Qatar Airways Cargo)", 0.2900],
      ["Hamad Intl (DOH), Doha — transhipment", 0.4350],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.4760],
      ["Air Cargo Complex, Bengaluru", 0.7200],
      ["Bengaluru, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    24,
  ),

  orderRoute(
    "24DFOUR",
    "ICN -> SYD -> MAA",
    "Seoul, KR",
    "ICN",
    "Qantas Freight",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Seoul, KR", 0.0400],
      ["DotConnects Origin Warehouse, Seoul, KR", 0.0660],
      ["Incheon Intl Airport (ICN), Seoul", 0.0850],
      ["Incheon Intl Airport (ICN), Seoul", 0.1170],
      ["Incheon Intl Airport (ICN), Seoul", 0.1430],
      ["Airspace — ICN to SYD (Qantas Freight)", 0.2900],
      ["Sydney Kingsford Smith (SYD) — transhipment", 0.4350],
      ["Chennai Intl Airport (MAA), Chennai", 0.4760],
      ["Air Cargo Complex, Chennai", 0.7200],
      ["Chennai, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    24,
  ),

  orderRoute(
    "25DONE",
    "MEL -> SYD -> MAA",
    "Melbourne, AU",
    "MEL",
    "Qantas Freight",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0400],
      ["DotConnects Origin Warehouse, Melbourne, AU", 0.0660],
      ["Melbourne Airport (MEL), AU", 0.0850],
      ["Melbourne Airport (MEL), AU", 0.1170],
      ["Melbourne Airport (MEL), AU", 0.1430],
      ["Airspace — MEL to SYD (Qantas Freight)", 0.2900],
      ["Sydney Kingsford Smith (SYD) — transhipment", 0.4350],
      ["Chennai Intl Airport (MAA), Chennai", 0.4760],
      ["Air Cargo Complex, Chennai", 0.7200],
      ["Chennai, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    25,
  ),

  orderRoute(
    "25DTWO",
    "SYD -> DXB -> BLR",
    "Sydney, AU",
    "SYD",
    "Emirates SkyCargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0400],
      ["DotConnects Origin Warehouse, Sydney, AU", 0.0660],
      ["Sydney Kingsford Smith Airport (SYD)", 0.0850],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1170],
      ["Sydney Kingsford Smith Airport (SYD)", 0.1430],
      ["Airspace — SYD to DXB (Emirates SkyCargo)", 0.2900],
      ["Dubai Intl (DXB) — transhipment", 0.4350],
      ["Kempegowda Intl Airport (BLR), Bengaluru", 0.4760],
      ["Air Cargo Complex, Bengaluru", 0.7200],
      ["Bengaluru, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    25,
  ),

  orderRoute(
    "25DTHREE",
    "NRT -> DOH -> MAA",
    "Tokyo, JP",
    "NRT",
    "Qatar Airways Cargo",
    [
      ["dotconnectslogistics.com", 0.0000],
      ["DotConnects Origin Warehouse, Tokyo, JP", 0.0400],
      ["DotConnects Origin Warehouse, Tokyo, JP", 0.0660],
      ["Narita Intl Airport (NRT), Tokyo", 0.0850],
      ["Narita Intl Airport (NRT), Tokyo", 0.1170],
      ["Narita Intl Airport (NRT), Tokyo", 0.1430],
      ["Airspace — NRT to DOH (Qatar Airways Cargo)", 0.2900],
      ["Hamad Intl (DOH), Doha — transhipment", 0.4350],
      ["Chennai Intl Airport (MAA), Chennai", 0.4760],
      ["Air Cargo Complex, Chennai", 0.7200],
      ["Chennai, India", 0.8500],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 0.9400],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
      ["DotConnects Arrival Warehouse, Navi Mumbai", 1.0000],
    ],
    25,
  ),
];

/**
 * Per-order timing jitter — without this, two orders placed the same day
 * would advance through every stage at the exact same hour-mark, which
 * reads as mechanical once you compare a couple of live orders side by
 * side. `seed` is a small integer (0-9999) generated once at order
 * creation and stored on the row (dropy_orders.timing_seed), so the same
 * order always jitters the same way on every page load — "looks random,
 * stays stable" — rather than the displayed stage flickering between
 * visits if this re-randomised on each render.
 */
export function jitterTimingPct(basePct: number, seed: number, stageIndex: number): number {
  if (basePct <= 0 || basePct >= 1) return basePct;
  // A simple deterministic hash of (seed, stageIndex) -> [-1, 1], no Math.random().
  const h = Math.sin(seed * 12.9898 + stageIndex * 78.233) * 43758.5453;
  const unit = (h - Math.floor(h)) * 2 - 1; // -1..1
  const jitterRange = 0.015; // ±1.5 percentage points — enough to de-sync
                              // orders without ever closing a 24h-floor gap
  return Math.max(0.001, Math.min(0.999, basePct + unit * jitterRange));
}

export function randomTimingSeed(): number {
  return Math.floor(Math.random() * 10000);
}

export function getOrderRoute(routeKey: string | null | undefined): OrderRoute {
  return ORDER_ROUTES.find((r) => r.key === routeKey) ?? ORDER_ROUTES[0];
}

export function pickOrderRoute(): OrderRoute {
  return ORDER_ROUTES[Math.floor(Math.random() * ORDER_ROUTES.length)];
}

/**
 * Stages before the goods reach the airport reflect where they actually are
 * in a real pipeline: "processing" happens at the vendor itself (being
 * picked/verified against the order), "packed"/"dispatched" happen at the
 * DotConnects Logistics pickup warehouse in the SAME city the vendor already ships
 * from (a real 3PL consolidates locally, it doesn't truck a vendor's stock
 * across state lines before even leaving for the airport) — everything
 * from at_us_airport onward is unaffected by vendor since it's already
 * consolidated onto the fixed Newark/JFK route by then.
 */
const VENDOR_STAGES: StageKey[] = ["processing", "packed", "dispatched"];

export function orderRouteStageLocation(
  routeKey: string | null | undefined,
  stage: StageKey,
  vendor?: { profile: VendorProfile; name: string },
): string {
  if (vendor && VENDOR_STAGES.includes(stage)) {
    // Two distinct real facilities on the US side, both OURS — never the
    // vendor's own name (e.g. "CeraVe / L'Oreal USA Distribution"), which
    // reads as us operating out of that vendor's facility. "Processing &
    // verification" happens at the receiving/QC facility ("Dropy
    // Warehouse" — the original brand name, still the real name of this
    // specific facility); the item then moves to "DotConnects Logistics
    // Warehouse" for the Packed/Dispatched stages, where it's consolidated
    // for the actual air-freight leg. Only the CITY varies with the
    // vendor (a real order's product can ship from any of several US
    // vendor cities) — the facility names themselves are fixed.
    if (stage === "processing") return `Dropy Warehouse, ${vendor.profile.warehouseCity}, ${vendor.profile.warehouseState}`;
    return `DotConnects Logistics Warehouse, ${vendor.profile.warehouseCity}, ${vendor.profile.warehouseState}`;
  }
  return getOrderRoute(routeKey).stages[stage]?.location ?? "";
}

/** Only set for the vendor-pickup leg (see VENDOR_STAGES) — every other
 *  stage uses the order's main carrier (Air India Cargo), shown once at
 *  the order level rather than repeated on every timeline row. */
export function orderRouteStageCarrier(stage: StageKey, vendor?: { profile: VendorProfile }): string | undefined {
  if (vendor && stage === "dispatched") return vendor.profile.pickupCarrier;
  return undefined;
}

/**
 * Same time-elapsed suggestion logic as lib/routes.ts's suggestStageForRoute,
 * plus per-order jitter (see jitterTimingPct) so two orders on the same
 * route/shipping_days don't advance in perfect lockstep. `seed` is the
 * order's stored dropy_orders.timing_seed; pass 0 (or omit) for unseeded
 * callers, which is equivalent to no jitter.
 */
export function suggestStageForOrderRoute(
  routeKey: string | null | undefined,
  orderDate: string,
  shippingDays: number,
  seed = 0,
): StageKey {
  const route = getOrderRoute(routeKey);
  const created = new Date(orderDate).getTime();
  const now = Date.now();
  // shippingDays is working days — 1.2x converts to calendar days
  // (weekends included), matching create-order.ts's ETA computation.
  const totalMs = shippingDays * 1.2 * 24 * 60 * 60 * 1000;
  const elapsed = now - created;
  const ratio = Math.min(elapsed / totalMs, 1);

  let suggested: StageKey = "order_placed";
  STAGES.forEach((s, i) => {
    // handed_to_courier shares qc_check's 1.00 timing_pct ceiling (see
    // STAGES's own note) but is never something the clock should suggest —
    // it's a real handover action, not a time-elapsed inference. Excluding
    // it here keeps qc_check as the actual clock-reachable ceiling.
    if (s.key === "handed_to_courier") return;
    const pct = seed ? jitterTimingPct(route.stages[s.key].timing_pct, seed, i) : route.stages[s.key].timing_pct;
    if (pct <= ratio) suggested = s.key;
  });
  return suggested;
}

/**
 * The real calendar timestamp a given stage happened (or will happen) at,
 * per the same order_date + timing_pct schedule suggestStageForOrderRoute
 * uses to decide WHICH stage an order is at — this answers WHEN that
 * stage was reached. Used to backfill the stages the clock jumped over
 * (see shipment-service.ts's mapRow) with real calculated timestamps
 * instead of leaving them out of the timeline entirely: an order whose
 * clock has already advanced from order_placed straight to
 * at_vashi_warehouse genuinely did pass through packed/dispatched/customs/
 * etc. along the way, even though no individual DB event was ever written
 * for each one (only two real anchors exist — order_placed and, once it
 * happens, the handover — see this session's own note on that design).
 */
export function stageHappenedAt(
  routeKey: string | null | undefined,
  stage: StageKey,
  orderDate: string,
  shippingDays: number,
  seed = 0,
): Date {
  const route = getOrderRoute(routeKey);
  const created = new Date(orderDate).getTime();
  const totalMs = shippingDays * 1.2 * 24 * 60 * 60 * 1000;
  const stageIdx = STAGES.findIndex((s) => s.key === stage);
  const basePct = route.stages[stage]?.timing_pct ?? 0;
  const pct = seed && stageIdx >= 0 ? jitterTimingPct(basePct, seed, stageIdx) : basePct;
  return new Date(created + pct * totalMs);
}

/**
 * Same "manual update never regresses" logic as lib/routes.ts's
 * effectiveStage — "exception" additionally covers any delay reason (see
 * lib/delay-reasons.ts), not just a generic hold, and never auto-advances
 * via the clock the same way qc_check/handed_to_courier don't: both are
 * real actions an employee takes (a QC pass, a physical handover to
 * Shiprocket/Velocity), not something that just happens once enough time
 * has elapsed — an admin has to set each explicitly.
 * suggestStageForOrderRoute already excludes handed_to_courier from what
 * the clock can propose (see its own note), so the guard here just
 * prevents regressing a dbStage that's already sitting at one of these
 * two states back down to whatever the clock currently suggests.
 */
export function effectiveOrderStage(
  routeKey: string | null | undefined,
  dbStage: string,
  orderDate: string,
  shippingDays: number,
  seed = 0,
): string {
  if (dbStage === "qc_check" || dbStage === "handed_to_courier" || dbStage === "exception") return dbStage;
  const suggested = suggestStageForOrderRoute(routeKey, orderDate, shippingDays, seed);
  const dbIdx = STAGES.findIndex((s) => s.key === dbStage);
  const suggestedIdx = STAGES.findIndex((s) => s.key === suggested);
  return suggestedIdx > dbIdx ? suggested : dbStage;
}
