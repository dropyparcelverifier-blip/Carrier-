"use client";

import { STAGES, type StageKey } from "@/lib/types";
import { anchorFromRow, anchoredStageTime, etaAt } from "@/lib/stage-clock";
import { stageHappenedAt } from "@/lib/order-routes";

/**
 * Stage timeline for the admin detail screen — wireframe A3.
 *
 * Shows past and current stages with real timestamps, then FUTURE stages
 * greyed out with predicted dates.
 *
 * The greyed rows are ADMIN-ONLY (Gate 5 decision D6). The customer sees
 * completed and current stages only, so every per-stage date they read
 * refers to something that already happened. Predicted dates here are
 * decision support for the operator — "should I push this forward?" —
 * not a promise to anybody.
 */

type Props = {
  routeKey: string | null;
  orderDate: string;
  shippingDays: number;
  timingSeed: number;
  /** Stage as stored, which is what the operator actually committed. */
  currentStage: string;
  clockAnchorStage: string | null;
  clockAnchorAt: string | null;
  labelGeneratedAt: string | null;
  pickedUpAt: string | null;
  /** Real recorded events, newest last. */
  events: { stage: string; label: string; happened_at: string; note?: string | null }[];
};

const fmt = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
  " · " +
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function StageTimeline({
  routeKey, orderDate, shippingDays, timingSeed,
  currentStage, clockAnchorStage, clockAnchorAt,
  labelGeneratedAt, pickedUpAt, events,
}: Props) {
  const anchor = anchorFromRow(clockAnchorStage, clockAnchorAt);

  // Hold states sit outside the 0-100% timeline entirely (architecture
  // §5.2), so there is no "next stage" to predict for them.
  const held = currentStage === "damaged" || currentStage === "exception";

  const realEventStage =
    pickedUpAt ? "handed_to_courier" : labelGeneratedAt ? "qc_check" : null;
  const effectiveStage = realEventStage ?? currentStage;
  const currentIdx = STAGES.findIndex((s) => s.key === effectiveStage);

  const eventByStage = new Map(events.map((e) => [e.stage, e]));

  const predictedTime = (stage: StageKey): Date => {
    const anchored = anchoredStageTime(routeKey, stage, orderDate, shippingDays, anchor);
    if (anchored) return anchored;
    return stageHappenedAt(routeKey, stage, orderDate, shippingDays, timingSeed);
  };

  const realTime = (stage: StageKey): Date | null => {
    if (stage === "qc_check" && labelGeneratedAt) return new Date(labelGeneratedAt);
    if (stage === "handed_to_courier" && pickedUpAt) return new Date(pickedUpAt);
    const ev = eventByStage.get(stage);
    return ev?.happened_at ? new Date(ev.happened_at) : null;
  };

  return (
    <div className="flex flex-col">
      {STAGES.map((s, i) => {
        const isPast = currentIdx >= 0 && i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture = currentIdx >= 0 && i > currentIdx;

        const real = realTime(s.key);
        const when = real ?? (isFuture || held ? null : predictedTime(s.key));

        return (
          <div key={s.key} className="flex gap-3 pb-3.5 last:pb-0">
            {/* rail */}
            <div className="flex w-5 shrink-0 flex-col items-center">
              <span
                className={
                  isCurrent
                    ? "size-3 rounded-full bg-primary ring-4 ring-primary/20"
                    : isPast
                      ? "size-2.5 rounded-full bg-semantic-success"
                      : "size-2.5 rounded-full border-2 border-hairline-strong"
                }
              />
              {i < STAGES.length - 1 && (
                <span
                  className={`w-0.5 flex-1 ${isFuture ? "bg-hairline/40" : "bg-hairline"}`}
                />
              )}
            </div>

            {/* body */}
            <div className={`flex-1 pb-0.5 ${isFuture ? "opacity-45" : ""}`}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span
                  className={`text-body-sm ${
                    isCurrent ? "font-semibold text-ink" : "text-ink"
                  }`}
                >
                  {s.label}
                </span>
                {isCurrent && (
                  <span className="text-caption font-medium text-primary">← current</span>
                )}
                {real && (
                  <span className="text-caption text-semantic-success">recorded</span>
                )}
              </div>

              <div className="mt-0.5 text-caption text-ink-subtle">
                {/* qc_check and handed_to_courier are event-driven — the
                    clock never reaches them on its own, so predicting a
                    date for them would invent one. Say what actually
                    triggers them instead. */}
                {isFuture && s.key === "qc_check" && !real
                  ? "when the label is generated"
                  : isFuture && s.key === "handed_to_courier" && !real
                    ? "when the courier collects it"
                    : when
                      ? `${isFuture ? "~" : ""}${fmt(when)}`
                      : "—"}
              </div>

              {eventByStage.get(s.key)?.note && (
                <p className="mt-1 text-caption text-ink-tertiary">
                  {eventByStage.get(s.key)!.note}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {!held && (
        <p className="mt-2 border-t border-hairline pt-2.5 text-caption text-ink-tertiary">
          Greyed stages are predictions from this order&apos;s schedule — visible to you
          only. ETA {fmt(etaAt(orderDate, shippingDays))}.
        </p>
      )}
    </div>
  );
}
