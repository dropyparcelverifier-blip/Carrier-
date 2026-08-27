import { STAGES, type ShipmentMode, type StageKey } from "./types";

/**
 * Multiple USA -> Vashi shipping routes so different orders show a
 * realistically varied journey instead of all 13 stages sitting at the same
 * single location/timing every time. The 13 stage KEYS stay fixed (they're
 * what current_stage / STAGE_PROGRESS / the Supabase check constraint use) —
 * only the per-stage location text and timing_pct vary by route.
 *
 * A route is picked once per order (pickRandomRoute, called at order
 * creation) and stored as dotconnects_orders.route_key so the whole order's
 * lifecycle stays on that one journey.
 */
export type RouteStage = { location: string; timing_pct: number };
export type Route = {
  key: string;
  label: string; // internal/admin-facing description, e.g. "Newark -> Frankfurt -> Mumbai -> Vashi"
  /** Must match one of lib/network.ts ORIGINS[].country — used to pick a
   *  route matching the customer's actual selected origin market. */
  origin: string;
  /** Which shipping_mode(s) this route's geography is physically valid for.
   *  "Express Air" reuses the "Air Freight" routes (same physical airports/
   *  gateways, just a faster premium tier) rather than needing its own
   *  distinct geography — only Ocean Freight moves through different
   *  ports/customs points entirely, so it gets its own route set below. */
  modes: ShipmentMode[];
  stages: Record<StageKey, RouteStage>;
};

const AIR_MODES: ShipmentMode[] = ["Air Freight", "Express Air"];
const OCEAN_MODES: ShipmentMode[] = ["Ocean Freight"];

/** Builds a Route from 13 [location, timing_pct] pairs, in STAGES order. */
function route(
  key: string,
  origin: string,
  modes: ShipmentMode[],
  label: string,
  points: [string, number][],
): Route {
  if (points.length !== STAGES.length) {
    throw new Error(`Route ${key} must have exactly ${STAGES.length} stage points, got ${points.length}`);
  }
  const stages = {} as Record<StageKey, RouteStage>;
  STAGES.forEach((s, i) => {
    stages[s.key] = { location: points[i][0], timing_pct: points[i][1] };
  });
  return { key, label, origin, modes, stages };
}

export const ROUTES: Route[] = [
  // Frankfurt carries daily direct FRA -> BOM cargo capacity (Lufthansa
  // Cargo) — routing a Mumbai-bound shipment via Delhi and then trucking it
  // ~1,400 km to Mumbai would be a real forwarder's mistake, not a genuine
  // routing choice, so this lands straight into Mumbai like the other lanes.
  route("newark-frankfurt-mumbai", "United States", AIR_MODES, "Newark -> Frankfurt -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Newark, NJ", 0.05],
    ["DotConnects Logistics USA Warehouse, Newark, NJ", 0.15],
    ["Newark Liberty Intl Airport (EWR), NJ", 0.20],
    ["Newark Liberty Intl Airport (EWR), NJ", 0.25],
    ["Newark Liberty Intl Airport (EWR), NJ", 0.30],
    ["Airspace over the Atlantic — en route to Frankfurt", 0.35],
    ["Frankfurt Airport (FRA), Germany — transit hub", 0.55],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.70],
    ["Sahar Air Cargo Complex, Mumbai", 0.80],
    ["Mumbai, Maharashtra", 0.90],
    ["Destination warehouse, Navi Mumbai", 0.95],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("la-hongkong-mumbai", "United States", AIR_MODES, "Los Angeles -> Hong Kong -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Los Angeles, CA", 0.05],
    ["DotConnects Logistics USA Warehouse, Los Angeles, CA", 0.16],
    ["Los Angeles Intl Airport (LAX), CA", 0.21],
    ["Los Angeles Intl Airport (LAX), CA", 0.27],
    ["Los Angeles Intl Airport (LAX), CA", 0.32],
    ["Airspace over the Pacific — en route to Hong Kong", 0.38],
    ["Hong Kong Intl Airport (HKG) — transit hub", 0.58],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.72],
    ["Sahar Air Cargo Complex, Mumbai", 0.82],
    ["Mumbai, Maharashtra", 0.90],
    ["Destination warehouse, Navi Mumbai", 0.96],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("chicago-dubai-mumbai", "United States", AIR_MODES, "Chicago -> Dubai -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Chicago, IL", 0.04],
    ["DotConnects Logistics USA Warehouse, Chicago, IL", 0.14],
    ["O'Hare Intl Airport (ORD), Chicago, IL", 0.19],
    ["O'Hare Intl Airport (ORD), Chicago, IL", 0.24],
    ["O'Hare Intl Airport (ORD), Chicago, IL", 0.29],
    ["Airspace over the Atlantic — en route to Dubai", 0.34],
    ["Dubai Intl Airport (DXB), UAE — transit hub", 0.52],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.68],
    ["Sahar Air Cargo Complex, Mumbai", 0.78],
    ["Mumbai, Maharashtra", 0.88],
    ["Destination warehouse, Navi Mumbai", 0.94],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  // There's no meaningful direct Tokyo -> Bengaluru air-cargo lane — real
  // NRT-origin freight bound for India flies direct to Mumbai or transits
  // Hong Kong/Singapore, not a detour ~2,000 km inland only to truck back.
  // Narita -> Mumbai direct cargo capacity exists (ANA Cargo), so this lane
  // lands straight into BOM like the Newark and Chicago lanes above.
  route("seattle-tokyo-mumbai", "United States", AIR_MODES, "Seattle -> Tokyo -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Seattle, WA", 0.05],
    ["DotConnects Logistics USA Warehouse, Seattle, WA", 0.17],
    ["Seattle-Tacoma Intl Airport (SEA), WA", 0.22],
    ["Seattle-Tacoma Intl Airport (SEA), WA", 0.28],
    ["Seattle-Tacoma Intl Airport (SEA), WA", 0.33],
    ["Airspace over the Pacific — en route to Tokyo", 0.39],
    ["Narita Intl Airport (NRT), Tokyo — transit hub", 0.57],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.71],
    ["Sahar Air Cargo Complex, Mumbai", 0.81],
    ["Mumbai, Maharashtra", 0.89],
    ["Destination warehouse, Navi Mumbai", 0.95],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("miami-doha-mumbai", "United States", AIR_MODES, "Miami -> Doha -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Miami, FL", 0.05],
    ["DotConnects Logistics USA Warehouse, Miami, FL", 0.15],
    ["Miami Intl Airport (MIA), FL", 0.20],
    ["Miami Intl Airport (MIA), FL", 0.26],
    ["Miami Intl Airport (MIA), FL", 0.31],
    ["Airspace over the Atlantic — en route to Doha", 0.37],
    ["Hamad Intl Airport (DOH), Doha — transit hub", 0.56],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.70],
    ["Sahar Air Cargo Complex, Mumbai", 0.80],
    ["Mumbai, Maharashtra", 0.89],
    ["Destination warehouse, Navi Mumbai", 0.95],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("dallas-amsterdam-mumbai", "United States", AIR_MODES, "Dallas -> Amsterdam -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Dallas, TX", 0.04],
    ["DotConnects Logistics USA Warehouse, Dallas, TX", 0.14],
    ["Dallas-Fort Worth Intl Airport (DFW), TX", 0.19],
    ["Dallas-Fort Worth Intl Airport (DFW), TX", 0.25],
    ["Dallas-Fort Worth Intl Airport (DFW), TX", 0.30],
    ["Airspace over the Atlantic — en route to Amsterdam", 0.36],
    ["Schiphol Airport (AMS), Amsterdam — transit hub", 0.55],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.69],
    ["Sahar Air Cargo Complex, Mumbai", 0.79],
    ["Mumbai, Maharashtra", 0.88],
    ["Destination warehouse, Navi Mumbai", 0.94],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("atlanta-istanbul-mumbai", "United States", AIR_MODES, "Atlanta -> Istanbul -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Atlanta, GA", 0.05],
    ["DotConnects Logistics USA Warehouse, Atlanta, GA", 0.16],
    ["Hartsfield-Jackson Airport (ATL), Atlanta, GA", 0.21],
    ["Hartsfield-Jackson Airport (ATL), Atlanta, GA", 0.27],
    ["Hartsfield-Jackson Airport (ATL), Atlanta, GA", 0.32],
    ["Airspace over the Atlantic — en route to Istanbul", 0.38],
    ["Istanbul Airport (IST), Turkey — transit hub", 0.58],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.72],
    ["Sahar Air Cargo Complex, Mumbai", 0.82],
    ["Mumbai, Maharashtra", 0.90],
    ["Destination warehouse, Navi Mumbai", 0.96],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("boston-london-mumbai", "United States", AIR_MODES, "Boston -> London -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Boston, MA", 0.04],
    ["DotConnects Logistics USA Warehouse, Boston, MA", 0.13],
    ["Logan Intl Airport (BOS), Boston, MA", 0.18],
    ["Logan Intl Airport (BOS), Boston, MA", 0.24],
    ["Logan Intl Airport (BOS), Boston, MA", 0.29],
    ["Airspace over the Atlantic — en route to London", 0.35],
    ["Heathrow Airport (LHR), London — transit hub", 0.53],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.66],
    ["Sahar Air Cargo Complex, Mumbai", 0.76],
    ["Mumbai, Maharashtra", 0.86],
    ["Destination warehouse, Navi Mumbai", 0.93],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("sf-singapore-mumbai", "United States", AIR_MODES, "San Francisco -> Singapore -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, San Francisco, CA", 0.05],
    ["DotConnects Logistics USA Warehouse, San Francisco, CA", 0.17],
    ["San Francisco Intl Airport (SFO), CA", 0.23],
    ["San Francisco Intl Airport (SFO), CA", 0.29],
    ["San Francisco Intl Airport (SFO), CA", 0.34],
    ["Airspace over the Pacific — en route to Singapore", 0.40],
    ["Changi Airport (SIN), Singapore — transit hub", 0.60],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.73],
    ["Sahar Air Cargo Complex, Mumbai", 0.83],
    ["Mumbai, Maharashtra", 0.91],
    ["Destination warehouse, Navi Mumbai", 0.97],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("houston-doha-mumbai", "United States", AIR_MODES, "Houston -> Doha -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Houston, TX", 0.04],
    ["DotConnects Logistics USA Warehouse, Houston, TX", 0.14],
    ["George Bush Intercontinental Airport (IAH), Houston, TX", 0.20],
    ["George Bush Intercontinental Airport (IAH), Houston, TX", 0.26],
    ["George Bush Intercontinental Airport (IAH), Houston, TX", 0.31],
    ["Airspace over the Atlantic — en route to Doha", 0.37],
    ["Hamad Intl Airport (DOH), Doha — transit hub", 0.56],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.70],
    ["Sahar Air Cargo Complex, Mumbai", 0.80],
    ["Mumbai, Maharashtra", 0.89],
    ["Destination warehouse, Navi Mumbai", 0.95],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("denver-paris-mumbai", "United States", AIR_MODES, "Denver -> Paris -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Denver, CO", 0.05],
    ["DotConnects Logistics USA Warehouse, Denver, CO", 0.16],
    ["Denver Intl Airport (DEN), CO", 0.21],
    ["Denver Intl Airport (DEN), CO", 0.27],
    ["Denver Intl Airport (DEN), CO", 0.32],
    ["Airspace over the Atlantic — en route to Paris", 0.38],
    ["Charles de Gaulle Airport (CDG), Paris — transit hub", 0.57],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.71],
    ["Sahar Air Cargo Complex, Mumbai", 0.81],
    ["Mumbai, Maharashtra", 0.89],
    ["Destination warehouse, Navi Mumbai", 0.95],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("nj-abudhabi-mumbai", "United States", AIR_MODES, "Edison NJ -> Abu Dhabi -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Edison, NJ", 0.04],
    ["DotConnects Logistics USA Warehouse, Edison, NJ", 0.13],
    ["Newark Liberty Intl Airport (EWR), NJ", 0.18],
    ["Newark Liberty Intl Airport (EWR), NJ", 0.24],
    ["Newark Liberty Intl Airport (EWR), NJ", 0.29],
    ["Airspace over the Atlantic — en route to Abu Dhabi", 0.35],
    ["Zayed Intl Airport (AUH), Abu Dhabi — transit hub", 0.54],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.68],
    ["Sahar Air Cargo Complex, Mumbai", 0.78],
    ["Mumbai, Maharashtra", 0.87],
    ["Destination warehouse, Navi Mumbai", 0.93],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("philly-zurich-mumbai", "United States", AIR_MODES, "Philadelphia -> Zurich -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Philadelphia, PA", 0.04],
    ["DotConnects Logistics USA Warehouse, Philadelphia, PA", 0.14],
    ["Philadelphia Intl Airport (PHL), PA", 0.19],
    ["Philadelphia Intl Airport (PHL), PA", 0.25],
    ["Philadelphia Intl Airport (PHL), PA", 0.30],
    ["Airspace over the Atlantic — en route to Zurich", 0.36],
    ["Zurich Airport (ZRH), Switzerland — transit hub", 0.55],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.69],
    ["Sahar Air Cargo Complex, Mumbai", 0.79],
    ["Mumbai, Maharashtra", 0.88],
    ["Destination warehouse, Navi Mumbai", 0.94],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("phoenix-seoul-mumbai", "United States", AIR_MODES, "Phoenix -> Seoul -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Phoenix, AZ", 0.05],
    ["DotConnects Logistics USA Warehouse, Phoenix, AZ", 0.16],
    ["Phoenix Sky Harbor Intl Airport (PHX), AZ", 0.22],
    ["Phoenix Sky Harbor Intl Airport (PHX), AZ", 0.28],
    ["Phoenix Sky Harbor Intl Airport (PHX), AZ", 0.33],
    ["Airspace over the Pacific — en route to Seoul", 0.39],
    ["Incheon Intl Airport (ICN), Seoul — transit hub", 0.58],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.71],
    ["Sahar Air Cargo Complex, Mumbai", 0.81],
    ["Mumbai, Maharashtra", 0.89],
    ["Destination warehouse, Navi Mumbai", 0.95],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  /*
   * ---- Non-US source markets ----
   * lib/network.ts ORIGINS lists five main markets, not just the US — these
   * four routes give UK/South Korea/Japan/Australia orders a real journey
   * instead of always falling back to a US route regardless of what the
   * customer actually selected on /quote.
   */

  // LHR -> BOM is a real direct cargo lane (British Airways/Air India) —
  // no transit hub needed, unlike the layered US routes above.
  route("london-mumbai", "United Kingdom", AIR_MODES, "London -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics UK Warehouse, London, UK", 0.05],
    ["DotConnects Logistics UK Warehouse, London, UK", 0.16],
    ["Heathrow Airport (LHR), London", 0.22],
    ["Heathrow Airport (LHR), London", 0.29],
    ["Heathrow Airport (LHR), London", 0.36],
    ["Airspace over the Arabian Sea — en route to Mumbai", 0.45],
    ["Airspace over the Arabian Sea — en route to Mumbai", 0.58],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.70],
    ["Sahar Air Cargo Complex, Mumbai", 0.80],
    ["Mumbai, Maharashtra", 0.90],
    ["Destination warehouse, Navi Mumbai", 0.95],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  // Korean Air Cargo runs ICN -> BOM direct — the exact lane already
  // documented in lib/network.ts CARRIERS ("Direct Incheon to Mumbai for
  // K-beauty volume").
  route("seoul-mumbai", "South Korea", AIR_MODES, "Seoul -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics Korea Warehouse, Seoul, South Korea", 0.05],
    ["DotConnects Logistics Korea Warehouse, Seoul, South Korea", 0.17],
    ["Incheon Intl Airport (ICN), Seoul", 0.24],
    ["Incheon Intl Airport (ICN), Seoul", 0.31],
    ["Incheon Intl Airport (ICN), Seoul", 0.38],
    ["Airspace over the Indian Ocean — en route to Mumbai", 0.48],
    ["Airspace over the Indian Ocean — en route to Mumbai", 0.60],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.72],
    ["Sahar Air Cargo Complex, Mumbai", 0.81],
    ["Mumbai, Maharashtra", 0.90],
    ["Destination warehouse, Navi Mumbai", 0.95],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  // ANA Cargo runs NRT -> BOM direct — matches CARRIERS's own note
  // ("Narita to Mumbai for J-beauty consignments").
  route("tokyo-mumbai", "Japan", AIR_MODES, "Tokyo -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics Japan Warehouse, Tokyo, Japan", 0.05],
    ["DotConnects Logistics Japan Warehouse, Tokyo, Japan", 0.17],
    ["Narita Intl Airport (NRT), Tokyo", 0.24],
    ["Narita Intl Airport (NRT), Tokyo", 0.31],
    ["Narita Intl Airport (NRT), Tokyo", 0.38],
    ["Airspace over the Indian Ocean — en route to Mumbai", 0.48],
    ["Airspace over the Indian Ocean — en route to Mumbai", 0.60],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.72],
    ["Sahar Air Cargo Complex, Mumbai", 0.81],
    ["Mumbai, Maharashtra", 0.90],
    ["Destination warehouse, Navi Mumbai", 0.95],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  // Sydney has no significant direct cargo lane to Mumbai — real Qantas
  // Freight uplift out of Australia routes via Singapore, per CARRIERS's
  // own note ("Sydney uplift, usually via Singapore").
  route("sydney-singapore-mumbai", "Australia", AIR_MODES, "Sydney -> Singapore -> Mumbai -> Vashi", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics Australia Warehouse, Sydney, Australia", 0.05],
    ["DotConnects Logistics Australia Warehouse, Sydney, Australia", 0.16],
    ["Kingsford Smith Airport (SYD), Sydney", 0.22],
    ["Kingsford Smith Airport (SYD), Sydney", 0.28],
    ["Kingsford Smith Airport (SYD), Sydney", 0.34],
    ["Airspace over the Indian Ocean — en route to Singapore", 0.42],
    ["Changi Airport (SIN), Singapore — transit hub", 0.60],
    ["Chhatrapati Shivaji Intl Airport (BOM), Mumbai", 0.74],
    ["Sahar Air Cargo Complex, Mumbai", 0.83],
    ["Mumbai, Maharashtra", 0.91],
    ["Destination warehouse, Navi Mumbai", 0.96],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  /*
   * ---- Ocean freight (FCL/LCL) ----
   * Matches components/TransportModes.tsx's own claims exactly — "New York,
   * Houston, Savannah and Los Angeles into Nhava Sheva, Mundra and Chennai",
   * Maersk/CMA CGM (lib/network.ts CARRIERS), weekly sailings, 34-46 days.
   * Same 13-stage schema as the air routes (current_stage is one shared DB
   * enum across every mode), but timing_pct is stretched to reflect how an
   * ocean voyage actually spends its time: origin port dwell and the sea
   * crossing itself dominate, not the short customs/warehouse windows a
   * flight has. Customs/warehouse legs land at Nhava Sheva (JNPT) — the
   * real sea-cargo clearance point per lib/network.ts FACILITIES, distinct
   * from the air routes' Sahar Air Cargo Complex.
   */
  route("newyork-nhavasheva", "United States", OCEAN_MODES, "New York -> Nhava Sheva -> Vashi (Ocean)", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, New York, NY", 0.03],
    ["DotConnects Logistics USA Warehouse, New York, NY", 0.08],
    ["Port of New York and New Jersey — container yard", 0.11],
    ["Port of New York and New Jersey — container yard", 0.14],
    ["Port of New York and New Jersey — container yard", 0.17],
    ["At sea — Atlantic crossing, en route to Nhava Sheva", 0.25],
    ["At sea — Atlantic crossing, en route to Nhava Sheva", 0.60],
    ["Jawaharlal Nehru Port (Nhava Sheva), Maharashtra", 0.78],
    ["JNPT Customs House, Nhava Sheva", 0.88],
    ["Nhava Sheva, Navi Mumbai", 0.93],
    ["Destination warehouse, Navi Mumbai", 0.97],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("houston-mundra", "United States", OCEAN_MODES, "Houston -> Mundra -> Vashi (Ocean)", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Houston, TX", 0.03],
    ["DotConnects Logistics USA Warehouse, Houston, TX", 0.08],
    ["Port of Houston — container terminal", 0.11],
    ["Port of Houston — container terminal", 0.14],
    ["Port of Houston — container terminal", 0.17],
    ["At sea — Atlantic crossing, en route to Mundra", 0.25],
    ["At sea — Atlantic crossing, en route to Mundra", 0.60],
    ["Mundra Port, Gujarat", 0.78],
    ["Mundra Customs House, Gujarat", 0.88],
    ["Mundra Port, Gujarat — inland movement to Vashi", 0.93],
    ["Destination warehouse, Navi Mumbai", 0.97],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("savannah-nhavasheva", "United States", OCEAN_MODES, "Savannah -> Nhava Sheva -> Vashi (Ocean)", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Savannah, GA", 0.03],
    ["DotConnects Logistics USA Warehouse, Savannah, GA", 0.08],
    ["Port of Savannah — Garden City Terminal", 0.11],
    ["Port of Savannah — Garden City Terminal", 0.14],
    ["Port of Savannah — Garden City Terminal", 0.17],
    ["At sea — Atlantic crossing, en route to Nhava Sheva", 0.25],
    ["At sea — Atlantic crossing, en route to Nhava Sheva", 0.62],
    ["Jawaharlal Nehru Port (Nhava Sheva), Maharashtra", 0.80],
    ["JNPT Customs House, Nhava Sheva", 0.89],
    ["Nhava Sheva, Navi Mumbai", 0.93],
    ["Destination warehouse, Navi Mumbai", 0.97],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),

  route("la-chennai-ocean", "United States", OCEAN_MODES, "Los Angeles -> Chennai -> Vashi (Ocean)", [
    ["dotconnectslogistics.com", 0],
    ["DotConnects Logistics USA Warehouse, Los Angeles, CA", 0.03],
    ["DotConnects Logistics USA Warehouse, Los Angeles, CA", 0.08],
    ["Port of Los Angeles — container terminal", 0.11],
    ["Port of Los Angeles — container terminal", 0.14],
    ["Port of Los Angeles — container terminal", 0.17],
    ["At sea — Pacific & Indian Ocean crossing, en route to Chennai", 0.25],
    ["At sea — Pacific & Indian Ocean crossing, en route to Chennai", 0.65],
    ["Chennai Port, Tamil Nadu", 0.82],
    ["Chennai Customs House, Tamil Nadu", 0.90],
    ["Chennai, Tamil Nadu — inland movement to Vashi", 0.94],
    ["Destination warehouse, Navi Mumbai", 0.97],
    ["Destination warehouse, Navi Mumbai", 1.00],
    ["Destination warehouse, Navi Mumbai", 1.00],
  ]),
];

/** Every route location, deduped — a quick sanity pool (50+ distinct waypoints across all routes). */
export const ALL_LOCATIONS: string[] = [
  ...new Set(ROUTES.flatMap((r) => Object.values(r.stages).map((s) => s.location))),
];

export function getRoute(routeKey: string | null | undefined): Route {
  return ROUTES.find((r) => r.key === routeKey) ?? ROUTES[0];
}

/**
 * Picks a random route matching the given origin market (must be one of
 * lib/network.ts ORIGINS[].country) and shipping mode. Each filter falls
 * back to the wider pool if it would otherwise leave zero candidates — an
 * order never fails to get a route, it just won't be fully accurate until
 * that origin/mode combination gets its own route (e.g. UK ocean freight
 * doesn't exist yet, so a UK order marked Ocean Freight falls back to any
 * origin's ocean route rather than failing outright).
 */
export function pickRandomRoute(originCountry?: string | null, mode?: ShipmentMode | null): Route {
  const byMode = mode ? ROUTES.filter((r) => r.modes.includes(mode)) : ROUTES;
  const modePool = byMode.length ? byMode : ROUTES;
  const byOrigin = originCountry ? modePool.filter((r) => r.origin === originCountry) : modePool;
  const pool = byOrigin.length ? byOrigin : modePool;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function routeStageLocation(routeKey: string | null | undefined, stage: StageKey): string {
  return getRoute(routeKey).stages[stage]?.location ?? "";
}

/** Route-aware replacement for the old global suggestStage() in lib/types.ts. */
export function suggestStageForRoute(
  routeKey: string | null | undefined,
  orderDate: string,
  shippingDays: number,
): StageKey {
  const route = getRoute(routeKey);
  const created = new Date(orderDate).getTime();
  const now = Date.now();
  const totalMs = shippingDays * 1.4 * 24 * 60 * 60 * 1000;
  const elapsed = now - created;
  const ratio = Math.min(elapsed / totalMs, 1);

  // handed_to_courier shares qc_check's 1.00 timing_pct ceiling (see
  // STAGES's own note in lib/types.ts) but is a real handover action, not
  // something time-elapsed alone should ever suggest — skipped here the
  // same way lib/order-routes.ts's suggestStageForOrderRoute does.
  let suggested: StageKey = "order_placed";
  for (const s of STAGES) {
    if (s.key === "handed_to_courier") continue;
    if (route.stages[s.key].timing_pct <= ratio) suggested = s.key;
  }
  return suggested;
}

/**
 * Live "effective" stage for display — the DB's current_stage is only ever
 * set by a manual admin action (or the initial insert), so on its own it
 * goes stale the moment nobody touches the order. This layers time-based
 * progress on top without a cron: whichever stage is further along, the
 * manually-set one or the one time-elapsed would suggest, wins. A manual
 * update never regresses (its own click already set current_stage forward),
 * and the terminal qc_check stage is never surfaced past by the clock.
 */
export function effectiveStage(
  routeKey: string | null | undefined,
  dbStage: string,
  orderDate: string,
  shippingDays: number,
): string {
  if (dbStage === "qc_check" || dbStage === "handed_to_courier" || dbStage === "exception") return dbStage;
  const suggested = suggestStageForRoute(routeKey, orderDate, shippingDays);
  const dbIdx = STAGES.findIndex((s) => s.key === dbStage);
  const suggestedIdx = STAGES.findIndex((s) => s.key === suggested);
  return suggestedIdx > dbIdx ? suggested : dbStage;
}
