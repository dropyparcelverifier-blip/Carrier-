"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { ChevronDown, Plane, Ship } from "lucide-react";
import { DOMESTIC_HUBS, WORLD_HUBS, type Lane } from "@/lib/network";
import { LAND_PATH, project } from "@/lib/world-land";
import { EASE } from "./motion/primitives";
import { cx } from "./ui";

/**
 * Every inbound lane on one map, drawn simultaneously.
 *
 * This replaced a panel that rotated through one leg at a time. Rotation hid
 * the actual point: five source markets all converging on a single clearance
 * and labelling hub in Navi Mumbai. Seen together, the shape of the operation
 * is obvious in a glance.
 *
 * Each lane is coloured by its CURRENT status, and its marker sits at the
 * position that lane actually reports — never past it.
 */

/** Vashi, Navi Mumbai — where every lane terminates. */
const HUB: [number, number] = [73.0, 19.08];

/*
 * Window on the 1000x500 world. Must hold Newark (x=294) through Sydney
 * (x=920, y=344) with room for labels — Australia is what forces the height.
 *
 * The top needs more slack than the widest origin does: the London arc's
 * control point sits at y=46, putting the drawn apex near y=76, above the
 * LHR label. A tighter top clipped both flat against the panel edge.
 */
const VIEW = { x: 244, y: 52, w: 734, h: 326 };

const AIRCRAFT =
  "M 7 0 C 5.3 -0.8 2.6 -1 1.3 -1 L -3 -4.6 L -4.6 -4.6 L -2.3 -1 " +
  "L -4.8 -1 L -5.8 -2.3 L -6.7 -2.3 L -6.3 0 L -6.7 2.3 L -5.8 2.3 " +
  "L -4.8 1 L -2.3 1 L -4.6 4.6 L -3 4.6 L 1.3 1 C 2.6 1 5.3 0.8 7 0 Z";
const VESSEL = "M 7 0 L 3 2.6 L -6.2 2.6 L -6.7 0 L -6.2 -2.6 L 3 -2.6 Z";

/** A small building silhouette — marks a warehouse/pickup point on the map. */
const WAREHOUSE = "M 0 -4.2 L 4.6 -1 L 4.6 4.2 L -4.6 4.2 L -4.6 -1 Z";

/** Status drives the lane colour. Same palette as the tracker's pills. */
const STATUS: Record<
  Lane["status"],
  { stroke: string; fill: string; text: string; dot: string }
> = {
  "In transit": {
    stroke: "stroke-primary",
    fill: "fill-primary",
    text: "text-primary-hover",
    dot: "bg-primary",
  },
  "Customs clearance": {
    stroke: "stroke-semantic-warn",
    fill: "fill-semantic-warn",
    text: "text-semantic-warn",
    dot: "bg-semantic-warn",
  },
  "MRP labelling": {
    stroke: "stroke-semantic-info",
    fill: "fill-semantic-info",
    text: "text-semantic-info",
    dot: "bg-semantic-info",
  },
  Delivered: {
    stroke: "stroke-semantic-success",
    fill: "fill-semantic-success",
    text: "text-semantic-success",
    dot: "bg-semantic-success",
  },
  Booked: {
    stroke: "stroke-ink-tertiary",
    fill: "fill-ink-tertiary",
    text: "text-ink-tertiary",
    dot: "bg-ink-tertiary",
  },
};

const ORDER: Lane["status"][] = [
  "In transit",
  "Customs clearance",
  "MRP labelling",
  "Delivered",
  "Booked",
];

/** Maps a lane's country to its flag asset — same five markets as Origins. */
const FLAG: Record<string, string> = {
  "United States": "/flags/us.svg",
  "United Kingdom": "/flags/gb.svg",
  "South Korea": "/flags/kr.svg",
  Japan: "/flags/jp.svg",
  Australia: "/flags/au.svg",
};

export default function NetworkMap({
  lanes,
  className,
}: {
  lanes: Lane[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const [hx, hy] = project(HUB[0], HUB[1]);
  const [openId, setOpenId] = useState<string | null>(null);

  /*
   * Two lanes can leave from effectively the same place — Newark airport and
   * the New York container terminal are 0.1 degrees apart, project onto the
   * same pixel, and stacked their labels into one unreadable run ("EWNYC").
   * Lanes sharing a cell get their label lifted a row higher than the last.
   */
  const labelRow = new Map<string, number>();
  {
    const seen = new Map<string, number>();
    for (const lane of lanes) {
      const [x, y] = project(lane.from[0], lane.from[1]);
      const cell = `${Math.round(x / 8)}:${Math.round(y / 8)}`;
      const n = seen.get(cell) ?? 0;
      seen.set(cell, n + 1);
      labelRow.set(lane.id, n);
    }
  }

  const arcOf = (from: [number, number]) => {
    const [ox, oy] = project(from[0], from[1]);
    const mx = (ox + hx) / 2;
    const my = Math.min(oy, hy) - Math.abs(hx - ox) * 0.3;
    return {
      ox,
      oy,
      d: `M ${ox.toFixed(1)} ${oy.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)}`,
    };
  };

  return (
    <div
      className={cx(
        "gradient-border edge-lift relative overflow-hidden rounded-xl bg-surface-1",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="relative flex size-1.5">
            {!reduce ? (
              <span className="pulse-ring absolute inline-flex size-full rounded-full bg-primary" />
            ) : null}
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          <span className="text-caption text-ink-muted">Inbound network</span>
        </span>
        <span className="font-mono text-[11px] text-ink-tertiary">
          {lanes.length} lanes · all to Vashi
        </span>
      </div>

      {/*
        Below `md` the arc geometry (tuned for a 734-unit-wide viewBox) has no
        room to be legible even scrolled — six markers converging on one hub
        just isn't a phone-shaped shape. Rather than shrink or side-scroll a
        desktop diagram, mobile gets its own artifact: a tappable list of
        lane "tickets", each opening to the same detail the desktop map's
        hover states imply but never actually show on a device with no
        hover. The SVG map stays for `md` and up, where the whole network at
        once is the more useful view.
      */}
      <ul className="flex flex-col gap-2 p-3 md:hidden">
        {lanes.map((lane) => {
          const tone = STATUS[lane.status];
          const isOpen = openId === lane.id;
          const ModeIcon = lane.mode === "air" ? Plane : Ship;
          const flag = FLAG[lane.country];
          return (
            <li
              key={lane.id}
              className="gradient-border overflow-hidden rounded-lg border border-hairline bg-surface-2"
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : lane.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-surface-3"
              >
                {flag ? (
                  <Image
                    src={flag}
                    alt=""
                    width={28}
                    height={20}
                    unoptimized
                    className="h-4 w-[26px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/15"
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-body-sm font-medium text-ink">
                      {lane.city}
                    </span>
                    <span className="font-mono text-[11px] text-ink-tertiary">
                      {lane.code}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <span className={cx("size-1.5 rounded-full", tone.dot)} />
                    <span className="text-caption text-ink-subtle">
                      {lane.status}
                    </span>
                  </span>
                </span>
                <ModeIcon
                  className={cx("size-4 shrink-0", tone.text)}
                  strokeWidth={1.8}
                />
                <ChevronDown
                  className={cx(
                    "size-4 shrink-0 text-ink-tertiary transition-transform duration-300",
                    isOpen && "rotate-180",
                  )}
                  strokeWidth={1.8}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-hairline px-3.5 py-3">
                      {/* the route, as a straight touch-friendly bar instead
                          of the desktop arc — the point on a phone is "how
                          far along", not the geometry of the great circle */}
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-ink-tertiary">
                          {lane.code}
                        </span>
                        <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                          <span
                            className={cx(
                              "absolute inset-y-0 left-0 rounded-full",
                              tone.fill,
                            )}
                            style={{ width: `${lane.progress}%` }}
                          />
                        </span>
                        <span className="font-mono text-[11px] text-ink-tertiary">
                          VASHI
                        </span>
                      </div>

                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
                        <div>
                          <dt className="text-ink-tertiary">Country</dt>
                          <dd className="mt-0.5 text-ink-muted">{lane.country}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-tertiary">Carrier</dt>
                          <dd className="mt-0.5 text-ink-muted">{lane.carrier}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-tertiary">Mode</dt>
                          <dd className="mt-0.5 text-ink-muted capitalize">
                            {lane.mode} freight
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-tertiary">Progress</dt>
                          <dd className={cx("mt-0.5", tone.text)}>
                            {lane.progress}% to Vashi
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>

      {/* SVG map is md+ only — mobile still needs to see the domestic reach */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3.5 pb-3 text-caption text-ink-tertiary md:hidden">
        <span className="size-1.5 shrink-0 rounded-full bg-accent" />
        From Vashi, onward to{" "}
        {DOMESTIC_HUBS.map((h) => h.city).join(" · ")}
      </div>

      <div className="hidden md:block">
      <svg
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
        className="block w-full"
        role="img"
        aria-label={`Inbound lanes from ${lanes
          .map((l) => l.city)
          .join(", ")}, all terminating at Vashi, Navi Mumbai.`}
      >
        <rect
          x={VIEW.x}
          y={VIEW.y}
          width={VIEW.w}
          height={VIEW.h}
          className="fill-surface-2"
        />
        {/* Meridians and parallels every 30°. Without them the landmass reads
            as an abstract silhouette; a faint grid gives it scale. */}
        <g className="stroke-hairline-strong" strokeWidth="0.3" opacity={0.5}>
          {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => {
            const [gx] = project(lon, 0);
            return (
              <line key={`m${lon}`} x1={gx} y1={VIEW.y} x2={gx} y2={VIEW.y + VIEW.h} />
            );
          })}
          {[-60, -30, 0, 30, 60].map((lat) => {
            const [, gy] = project(0, lat);
            return (
              <line key={`p${lat}`} x1={VIEW.x} y1={gy} x2={VIEW.x + VIEW.w} y2={gy} />
            );
          })}
        </g>
        <path
          d={LAND_PATH}
          fillRule="evenodd"
          className="fill-surface-4 stroke-hairline-strong"
          strokeWidth="0.4"
        />

        {/* one arc per lane */}
        {lanes.map((lane) => {
          const { ox, oy, d } = arcOf(lane.from);
          const tone = STATUS[lane.status];
          const pathId = `lane-${uid}-${lane.id}`;
          const frac = (lane.progress / 100).toFixed(3);
          return (
            <g key={lane.id}>
              {/* The remaining leg. Its dashes crawl toward Vashi so the map
                  reads as live even after every marker has parked. */}
              <path
                id={pathId}
                d={d}
                fill="none"
                className="stroke-ink-tertiary"
                strokeWidth="1.1"
                strokeDasharray="3 5"
                strokeLinecap="round"
                opacity={0.6}
              >
                {!reduce ? (
                  <animate
                    attributeName="stroke-dashoffset"
                    values="8;0"
                    dur="1.1s"
                    repeatCount="indefinite"
                  />
                ) : null}
              </path>
              <path
                d={d}
                fill="none"
                className={tone.stroke}
                strokeWidth="2"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${lane.progress} 100`}
              />

              {/* origin pin: a warehouse marker, not a plain dot — this is
                  where the lane's cargo is physically picked up. */}
              <circle cx={ox} cy={oy} r="7" className={cx(tone.fill, "opacity-20")} />
              <g transform={`translate(${ox} ${oy})`}>
                <path d={WAREHOUSE} className={tone.fill} />
                <path
                  d={WAREHOUSE}
                  className="fill-none stroke-surface-1"
                  strokeWidth="0.6"
                />
              </g>
              <text
                x={ox}
                y={oy - 10 - (labelRow.get(lane.id) ?? 0) * 11}
                textAnchor="middle"
                className="fill-ink font-mono text-[10px]"
              >
                {lane.code}
              </text>

              {/* marker parked at the reported position */}
              <g>
                <g transform="scale(1.15)">
                  <circle r="8" className={cx(tone.fill, "opacity-20")} />
                  <path
                    d={lane.mode === "air" ? AIRCRAFT : VESSEL}
                    className={tone.fill}
                  />
                  <path
                    d={lane.mode === "air" ? AIRCRAFT : VESSEL}
                    className="fill-none stroke-surface-1"
                    strokeWidth="0.6"
                  />
                </g>
                <animateMotion
                  dur={reduce ? "0.001s" : "2.4s"}
                  begin="0.3s"
                  fill="freeze"
                  repeatCount="1"
                  rotate="auto"
                  keyPoints={`0;${frac}`}
                  keyTimes="0;1"
                  calcMode="linear"
                >
                  <mpath href={`#${pathId}`} />
                </animateMotion>
              </g>
            </g>
          );
        })}

        {/*
          Last-mile spokes off Vashi. Distinct from the inbound lanes above —
          static, undashed-motion, muted colour — so the map reads as "one
          network arrives here, then fans out across India" rather than
          implying these are more incoming international legs.
        */}
        {DOMESTIC_HUBS.map((hub) => {
          const [dx, dy] = project(hub.coord[0], hub.coord[1]);
          return (
            <g key={hub.city}>
              <line
                x1={hx}
                y1={hy}
                x2={dx}
                y2={dy}
                className="stroke-ink-tertiary"
                strokeWidth="1"
                strokeDasharray="1.5 3.5"
                strokeLinecap="round"
                opacity={0.45}
              />
              <circle cx={dx} cy={dy} r="4.5" className="fill-accent/18" />
              <circle cx={dx} cy={dy} r="2.2" className="fill-accent" />
              <circle
                cx={dx}
                cy={dy}
                r="2.2"
                className="fill-none stroke-surface-1"
                strokeWidth="0.8"
              />
              <text
                x={dx}
                y={dy - 8}
                textAnchor="middle"
                className="fill-ink-subtle text-[9px]"
              >
                {hub.city}
              </text>
            </g>
          );
        })}

        {/*
          Additional warehouse-hub cities beyond the five active lanes —
          muted, no arc, no motion — so the map reads as "our reach is
          wider than what's moving right now" without competing with the
          coloured, animated lanes above.
        */}
        {WORLD_HUBS.map((hub) => {
          const [wx, wy] = project(hub.coord[0], hub.coord[1]);
          return (
            <g key={hub.city}>
              <circle cx={wx} cy={wy} r="6" className="fill-ink-tertiary/15" />
              <g transform={`translate(${wx} ${wy}) scale(0.85)`}>
                <path d={WAREHOUSE} className="fill-ink-tertiary" />
                <path
                  d={WAREHOUSE}
                  className="fill-none stroke-surface-1"
                  strokeWidth="0.6"
                />
              </g>
              <text
                x={wx}
                y={wy - 9}
                textAnchor="middle"
                className="fill-ink-tertiary text-[9px]"
              >
                {hub.city}
              </text>
            </g>
          );
        })}

        {/* the hub every lane converges on */}
        <circle cx={hx} cy={hy} r="14" className="fill-primary/12" />
        <circle cx={hx} cy={hy} r="8" className="fill-primary/25" />
        <circle cx={hx} cy={hy} r="4.2" className="fill-primary" />
        <circle
          cx={hx}
          cy={hy}
          r="4.2"
          className="fill-none stroke-surface-1"
          strokeWidth="1.4"
        />
        {!reduce ? (
          <circle cx={hx} cy={hy} r="4.2" fill="none" className="stroke-primary" strokeWidth="1.2">
            <animate attributeName="r" values="4.2;16" dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0" dur="2.6s" repeatCount="indefinite" />
          </circle>
        ) : null}
        <text x={hx} y={hy + 20} textAnchor="middle" className="fill-ink font-mono text-[11px]">
          VASHI
        </text>
        <text x={hx} y={hy + 32} textAnchor="middle" className="fill-ink-subtle text-[9px]">
          Mumbai
        </text>
      </svg>
      </div>

      {/* status legend — the lane colours mean something */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline px-4 py-3">
        {ORDER.filter((st) => lanes.some((l) => l.status === st)).map((st) => (
          <span key={st} className="inline-flex items-center gap-1.5">
            <span className={cx("size-1.5 rounded-full", STATUS[st].dot)} />
            <span className="text-caption text-ink-subtle">{st}</span>
          </span>
        ))}
        <span className="hidden items-center gap-1.5 border-l border-hairline pl-4 md:inline-flex">
          <span className="size-1.5 rounded-full bg-accent" />
          <span className="text-caption text-ink-subtle">
            Domestic hub ({DOMESTIC_HUBS.map((h) => h.city).join(", ")})
          </span>
        </span>
      </div>
    </div>
  );
}
