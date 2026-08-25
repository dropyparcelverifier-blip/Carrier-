import type { StageKey } from "./types";

/**
 * Reasons an admin can select when marking an order's stage as "exception"
 * (delayed/held) — surfaced on both the admin panel and the customer-facing
 * tracking timeline, so the reason needs to read clearly to someone outside
 * the company, not just as an internal shorthand.
 */
export const DELAY_REASONS = [
  "Misrouted",
  "Flight delayed",
  "Flight cancelled — rebooked",
  "Customs query",
  "Customs hold — documentation",
  "Weather delay",
  "Damaged in transit",
  "Awaiting carrier pickup",
  "Address / contact issue",
  "Other",
] as const;

export type DelayReason = (typeof DELAY_REASONS)[number];

/**
 * How long each delay reason realistically runs, and which of the 13
 * shipping stages it can plausibly be logged against — a "Flight delayed"
 * hold doesn't make sense once a shipment has already cleared Indian
 * customs, and a "Customs hold" doesn't make sense before the shipment has
 * even reached a customs stage. minHours/maxHours are the realistic
 * resolution window (used to suggest an expected-clear-by estimate on the
 * admin panel — see resolveByEstimate below), not a hard limit; an admin
 * can always clear an exception early or leave it open longer.
 */
export type DelayProfile = {
  reason: DelayReason;
  minHours: number;
  maxHours: number;
  /** Stages this reason can be logged against. Omitted = any non-final stage. */
  applicableStages?: StageKey[];
};

const ORIGIN_STAGES: StageKey[] = ["processing", "packed", "dispatched", "at_us_airport", "us_customs_cleared"];
const TRANSIT_STAGES: StageKey[] = ["at_us_airport", "in_transit_departed", "mid_transit"];
const INDIA_CUSTOMS_STAGES: StageKey[] = ["arrived_india", "indian_customs"];
const INDIA_LATE_STAGES: StageKey[] = ["indian_customs", "customs_cleared", "at_vashi_warehouse"];

export const DELAY_PROFILES: Record<DelayReason, DelayProfile> = {
  // A shipment routed to the wrong gateway/leg — caught and corrected
  // within a couple of days once someone notices, rarely drags on longer.
  "Misrouted": {
    reason: "Misrouted",
    minHours: 24,
    maxHours: 72,
    applicableStages: [...ORIGIN_STAGES, ...TRANSIT_STAGES],
  },
  // A single flight running late — hours to at most a couple of days if it
  // cascades into a missed connection-equivalent slot on the next Air
  // India departure (these are direct flights, so "missed connection"
  // really means "waiting for the next scheduled nonstop").
  "Flight delayed": {
    reason: "Flight delayed",
    minHours: 4,
    maxHours: 48,
    applicableStages: TRANSIT_STAGES,
  },
  // Needs a full rebooking onto the next available direct service — Air
  // India's Newark/JFK-Mumbai nonstops run a few times a week, not daily,
  // so this realistically runs longer than a plain delay.
  "Flight cancelled — rebooked": {
    reason: "Flight cancelled — rebooked",
    minHours: 24,
    maxHours: 96,
    applicableStages: TRANSIT_STAGES,
  },
  // A customs officer asking a clarifying question — usually resolved
  // within a business day or two once the paperwork is supplied.
  "Customs query": {
    reason: "Customs query",
    minHours: 12,
    maxHours: 48,
    applicableStages: INDIA_CUSTOMS_STAGES,
  },
  // A genuine documentation hold (missing CDSCO/FSSAI registration,
  // mismatched invoice) — the longest-running realistic cause, since it
  // depends on the importer supplying something customs won't proceed
  // without.
  "Customs hold — documentation": {
    reason: "Customs hold — documentation",
    minHours: 48,
    maxHours: 240,
    applicableStages: INDIA_CUSTOMS_STAGES,
  },
  // Grounds/slows flights at either end — short by nature, since airlines
  // reroute or wait out a weather window rather than cancel outright.
  "Weather delay": {
    reason: "Weather delay",
    minHours: 6,
    maxHours: 36,
    applicableStages: TRANSIT_STAGES,
  },
  // Needs a physical inspection + claims process before it can continue —
  // the shipment doesn't just wait, it's actively being assessed.
  "Damaged in transit": {
    reason: "Damaged in transit",
    minHours: 24,
    maxHours: 120,
    applicableStages: [...TRANSIT_STAGES, ...INDIA_CUSTOMS_STAGES],
  },
  // A pickup slot missed — either the first-mile origin warehouse (packed/
  // dispatched) or, just as realistically, the last-mile courier not
  // having actually collected the parcel from Vashi yet even though it's
  // been marked handed off — resolved on the next scheduled run, typically
  // next business day either way.
  "Awaiting carrier pickup": {
    reason: "Awaiting carrier pickup",
    minHours: 12,
    maxHours: 48,
    applicableStages: ["packed", "dispatched", "handed_to_courier"],
  },
  // Needs the customer to actually respond — bounded on the low end by
  // how fast a phone call gets answered, unbounded-feeling on the high end
  // since it depends entirely on the customer, not the carrier.
  "Address / contact issue": {
    reason: "Address / contact issue",
    minHours: 12,
    maxHours: 168,
    applicableStages: INDIA_LATE_STAGES,
  },
  // Catch-all — wide range since the real cause (and its real duration)
  // isn't one of the modeled reasons above.
  "Other": {
    reason: "Other",
    minHours: 4,
    maxHours: 168,
  },
};

/** Reasons that make sense to offer for a shipment currently sitting at `stage`. */
export function delayReasonsForStage(stage: StageKey): DelayReason[] {
  return DELAY_REASONS.filter((r) => {
    const stages = DELAY_PROFILES[r].applicableStages;
    return !stages || stages.includes(stage);
  });
}

/** A plausible "expected clear-by" timestamp for a delay logged right now. */
export function resolveByEstimate(reason: DelayReason, from: Date = new Date()): { min: Date; max: Date } {
  const profile = DELAY_PROFILES[reason];
  return {
    min: new Date(from.getTime() + profile.minHours * 60 * 60 * 1000),
    max: new Date(from.getTime() + profile.maxHours * 60 * 60 * 1000),
  };
}
