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

/**
 * The India gateway. Was described as "where every lane terminates" —
 * true of the original five inbound lanes, false now that the network
 * carries US-UK, UK-Japan and Japan-Australia. Still the busiest node,
 * and still the fallback for any lane defined without an explicit `to`.
 */
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
  "At bonded warehouse": {
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
  "At bonded warehouse",
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

/** Distinct endpoints across the lane set, for the header caption. */
function destCount(lanes: Lane[]): number {
  return new Set(
    lanes.map((l) => (l.to ? `${l.to[0]}:${l.to[1]}` : "hub")),
  ).size;
}

export default function NetworkMap({
  lanes,
  className,
}: {
  lanes: Lane[];
  className?: string;
}) {
  const DEST_COUNT = destCount(lanes);
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const [hx, hy] = project(HUB[0], HUB[1]);
  const [openId, setOpenId] = useState<string | null>(null);

  /**
   * Distinct destination nodes, derived from the lanes themselves.
   *
   * Hoisted out of the JSX because the label pass below needs the same set —
   * when the destinations were computed inline, the label code had no way to
   * know a node was already labelled as an origin.
   */
  const destNodes = (() => {
    const ends = new Map<string, { x: number; y: number; code: string; n: number }>();
    for (const lane of lanes) {
      const [x, y] = lane.to ? project(lane.to[0], lane.to[1]) : [hx, hy];
      const key = `${x.toFixed(0)}:${y.toFixed(0)}`;
      const prev = ends.get(key);
      if (prev) prev.n += 1;
      else {
        const dest = lanes.find(
          (l) => l.from[0] === (lane.to?.[0] ?? 0) && l.from[1] === (lane.to?.[1] ?? 0),
        );
        ends.set(key, { x, y, code: dest?.code ?? "BOM", n: 1 });
      }
    }
    return [...ends.values()];
  })();

  /**
   * ONE label per PLACE.
   *
   * This used to be four independent label families — one <text> per lane
   * origin, one per destination node, one per DOMESTIC_HUB, one per
   * WORLD_HUB — and only the origins had any de-collision, bucketed per
   * LANE. That was written for five lanes out of five distinct origins. At
   * fourteen lanes over eight gateways it drew 26 labels for 13 places:
   * "EWR" three times because three lanes leave Newark, "BOM" three times
   * because Mumbai is an origin twice and a destination five times, and
   * "DEL" printed straight over the "Delhi" hub label 2.6px away, reading
   * as "DELhi". None of the four families could see the other three.
   *
   * Now every label source is collected first, deduped by NODE, and only
   * then placed. A node that is both an origin and a destination gets one
   * label, not two: BOM is BOM regardless of which way the freight is
   * moving.
   */
  const mapLabels = (() => {
    /** Cell size for "these are the same place", in viewBox units. */
    const CELL = 8;
    /** Rough per-character advance. Only needs to be good enough to
     *  detect an overlap, not to typeset. */
    const MONO_CW = 6.0;
    const SANS_CW = 5.0;

    type Cand = {
      x: number;
      y: number;
      text: string;
      cls: string;
      cw: number;
      /** Lower wins when two sources land on the same node. */
      rank: number;
    };

    const cands: Cand[] = [];
    const CODE_CLS = "fill-ink font-mono text-[10px]";
    for (const lane of lanes) {
      const [x, y] = project(lane.from[0], lane.from[1]);
      cands.push({ x, y, text: lane.code, cls: CODE_CLS, cw: MONO_CW, rank: 0 });
    }
    for (const e of destNodes) {
      cands.push({ x: e.x, y: e.y, text: e.code, cls: CODE_CLS, cw: MONO_CW, rank: 0 });
    }
    for (const hub of DOMESTIC_HUBS) {
      const [x, y] = project(hub.coord[0], hub.coord[1]);
      cands.push({
        x, y,
        text: hub.city,
        cls: "fill-ink-subtle text-[9px]",
        cw: SANS_CW,
        rank: 1,
      });
    }
    for (const hub of WORLD_HUBS) {
      const [x, y] = project(hub.coord[0], hub.coord[1]);
      cands.push({
        x, y,
        text: hub.city,
        cls: "fill-ink-tertiary text-[9px]",
        cw: SANS_CW,
        rank: 2,
      });
    }

    // Collapse per node, but only what is genuinely redundant. Two things
    // look identical to a cell test and are not the same problem:
    //
    //   EWR + EWR + EWR   one place, three lanes      -> one label
    //   DEL + "Delhi"     one place, two NAMES        -> one label (the code)
    //   EWR + JFK         two places, one pixel       -> BOTH, de-collided
    //
    // An earlier pass kept a single label per cell outright and silently
    // dropped JFK, which is a real gateway with its own lanes. So: dedupe by
    // text, then let a lane code win over a hub city naming the same node,
    // and keep anything still standing.
    const cells = new Map<string, Cand[]>();
    for (const c of cands) {
      const key = `${Math.round(c.x / CELL)}:${Math.round(c.y / CELL)}`;
      const list = cells.get(key);
      if (!list) cells.set(key, [c]);
      else if (!list.some((p) => p.text === c.text)) list.push(c);
    }
    const kept: Cand[] = [];
    for (const list of cells.values()) {
      const best = Math.min(...list.map((c) => c.rank));
      for (const c of list) if (c.rank === best) kept.push(c);
    }

    // Genuinely distinct places can still collide, because what overlaps is
    // the TEXT, not the node: Bengaluru and Chennai are ~10px apart carrying
    // 60px and 49px of label.
    //
    // Resolve by moving a label AROUND its own node, not straight up. A
    // first attempt lifted 11px at a time until clear, which did separate
    // them — and left "Bengaluru" floating beside the Delhi marker and
    // "Chennai" beside the Mumbai dot. A label that has drifted onto someone
    // else's pin is worse than one that overlaps, because it is no longer
    // merely ugly, it is wrong. Each candidate slot keeps the text touching
    // its own node; the first slot that is clear wins.
    // Vertical slots first, and both of them centred: a centred label reads
    // as belonging to the pin directly under it. Sideways slots are the
    // fallback, because for two cities 10px apart (Bengaluru and Chennai) a
    // left/right offset sends one label straight across the other's dot —
    // legible, but it looks like it is naming the wrong city.
    const SLOTS: { dx: number; dy: number; anchor: "middle" | "start" | "end" }[] = [
      { dx: 0, dy: -11, anchor: "middle" },
      { dx: 0, dy: 15, anchor: "middle" },
      { dx: 8, dy: 3.5, anchor: "start" },
      { dx: -8, dy: 3.5, anchor: "end" },
      { dx: 8, dy: -8, anchor: "start" },
      { dx: -8, dy: -8, anchor: "end" },
      { dx: 8, dy: 14, anchor: "start" },
      { dx: -8, dy: 14, anchor: "end" },
    ];

    const placed: { x1: number; x2: number; y: number }[] = [];
    const out: {
      x: number;
      y: number;
      text: string;
      cls: string;
      anchor: "middle" | "start" | "end";
    }[] = [];

    // Codes first, so the lane endpoints — the subject of the map — get the
    // uncontested slot above their node and the softer hub names work around
    // them.
    for (const c of kept.sort((a, b) => a.rank - b.rank || a.y - b.y || a.x - b.x)) {
      const w = c.text.length * c.cw;
      const span = (slot: (typeof SLOTS)[number]) => {
        const x = c.x + slot.dx;
        if (slot.anchor === "start") return [x, x + w] as const;
        if (slot.anchor === "end") return [x - w, x] as const;
        return [x - w / 2, x + w / 2] as const;
      };
      const hits = (slot: (typeof SLOTS)[number]) => {
        const [x1, x2] = span(slot);
        const y = c.y + slot.dy;
        return placed.some(
          (p) => Math.abs(p.y - y) < 9 && p.x1 < x2 && x1 < p.x2,
        );
      };
      const slot = SLOTS.find((s) => !hits(s)) ?? SLOTS[0];
      const [x1, x2] = span(slot);
      const y = c.y + slot.dy;
      placed.push({ x1, x2, y });
      out.push({
        x: c.x + slot.dx,
        y,
        text: c.text,
        cls: c.cls,
        anchor: slot.anchor,
      });
    }
    return out;
  })();

  /**
   * An arc between a lane's OWN endpoints.
   *
   * This used to run every arc to one hardcoded HUB, so the map could
   * only draw hub-and-spoke — five lines converging on Mumbai. Lanes
   * between markets (New York to London, Seoul to Tokyo) need their own
   * destination, and `lane.to` now carries it.
   *
   * Falls back to HUB when `to` is absent, so any lane defined the old
   * way still renders.
   */
  const arcOf = (from: [number, number], to?: [number, number]) => {
    const [ox, oy] = project(from[0], from[1]);
    const [dx, dy] = to ? project(to[0], to[1]) : [hx, hy];
    const mx = (ox + dx) / 2;
    // Bow proportional to span, so a short hop (Seoul-Tokyo) stays flat
    // while a long one (New York-Sydney) arcs properly. A fixed factor
    // made short lanes look like they detoured via the Arctic.
    const my = Math.min(oy, dy) - Math.abs(dx - ox) * 0.28;
    return {
      ox, oy, dx, dy,
      d: `M ${ox.toFixed(1)} ${oy.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}`,
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
          <span className="text-caption text-ink-muted">Live network</span>
        </span>
        <span className="font-mono text-[11px] text-ink-tertiary">
          {lanes.length} lanes · {DEST_COUNT} destinations
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
                            {lane.progress}% of the way
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
        Onward across India to{" "}
        {DOMESTIC_HUBS.map((h) => h.city).join(" · ")}
      </div>

      <div className="hidden md:block">
      <svg
        id="map"
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
          const { ox, oy, dx, dy, d } = arcOf(lane.from, lane.to);
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
              {/* Label drawn in the single pass at the end of the svg, not
                  here — see mapLabels. */}

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
            </g>
          );
        })}

        {/*
            Destination nodes, derived from the lanes themselves.
            
            This was a single hardcoded "VASHI / Mumbai" marker with every
            arc converging on it — correct when the business was five
            origins into one hub, wrong now that stock moves between
            markets. Each distinct endpoint gets a node, sized by how many
            lanes terminate there, so Mumbai still reads as the busiest
            without pretending it's the only one.
        */}
        {destNodes.map((e) => {
          const r = 3 + Math.min(e.n, 5) * 0.5;
          return (
            <g key={`${e.x}-${e.y}`}>
              <circle cx={e.x} cy={e.y} r={r * 3.2} className="fill-primary/12" />
              <circle cx={e.x} cy={e.y} r={r * 1.9} className="fill-primary/25" />
              <circle cx={e.x} cy={e.y} r={r} className="fill-primary" />
              <circle cx={e.x} cy={e.y} r={r} className="fill-none stroke-surface-1" strokeWidth="1.4" />
              {!reduce && e.n > 2 ? (
                <circle cx={e.x} cy={e.y} r={r} fill="none" className="stroke-primary" strokeWidth="1.2">
                  <animate attributeName="r" values={`${r};16`} dur="2.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0" dur="2.6s" repeatCount="indefinite" />
                </circle>
              ) : null}
            </g>
          );
        })}

        {/* Every place label, in one pass and drawn last so no marker,
            arc or pulse ring overdraws a name. */}
        <g>
          {mapLabels.map((l) => (
            <text
              key={`${l.text}-${Math.round(l.x)}-${Math.round(l.y)}`}
              x={l.x}
              y={l.y}
              textAnchor={l.anchor}
              className={l.cls}
            >
              {l.text}
            </text>
          ))}
        </g>
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
