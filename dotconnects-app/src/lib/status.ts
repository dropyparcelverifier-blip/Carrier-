import type { Shipment } from "./types";

export type StatusStyle = {
  dot: string;
  pill: string;
  bar: string;
  text: string;
};

const LAVENDER: StatusStyle = {
  dot:  "bg-primary",
  pill: "border-primary/35 bg-primary/12 text-primary-hover",
  bar:  "bg-gradient-to-r from-primary/70 via-primary to-violet-400",
  text: "text-primary-hover",
};
const AMBER: StatusStyle = {
  dot:  "bg-semantic-warn",
  pill: "border-semantic-warn/35 bg-semantic-warn/12 text-semantic-warn",
  bar:  "bg-gradient-to-r from-semantic-warn/80 via-semantic-warn to-amber-400",
  text: "text-semantic-warn",
};
const ALERT: StatusStyle = {
  dot:  "bg-semantic-alert",
  pill: "border-semantic-alert/40 bg-semantic-alert/12 text-semantic-alert",
  bar:  "bg-gradient-to-r from-semantic-alert/70 via-semantic-alert to-red-400",
  text: "text-semantic-alert",
};
const CYAN: StatusStyle = {
  dot:  "bg-semantic-info",
  pill: "border-semantic-info/35 bg-semantic-info/12 text-semantic-info",
  bar:  "bg-gradient-to-r from-semantic-info/70 via-semantic-info to-sky-400",
  text: "text-semantic-info",
};
const GREEN: StatusStyle = {
  dot:  "bg-semantic-success",
  pill: "border-semantic-success/35 bg-semantic-success/12 text-semantic-success",
  bar:  "bg-gradient-to-r from-semantic-success/70 via-semantic-success to-emerald-400",
  text: "text-semantic-success",
};
const NEUTRAL: StatusStyle = {
  dot:  "bg-ink-subtle",
  pill: "border-hairline-strong bg-surface-3 text-ink-subtle",
  bar:  "bg-gradient-to-r from-ink-subtle/50 to-ink-subtle",
  text: "text-ink-subtle",
};

const BY_STATUS: Record<Shipment["status"], StatusStyle> = {
  "Order Placed":      NEUTRAL,
  "Processing":        LAVENDER,
  "In Transit":        LAVENDER,
  "Customs Clearance": AMBER,
  "At Warehouse":      CYAN,
  "Received":            GREEN,
  "Forwarded to Courier": GREEN,
  // Hold state (architecture §5.2). Explicitly alert-toned rather than
  // falling through to NEUTRAL — a damaged parcel rendered in the same
  // grey as "Order Placed" would read as routine.
  "Damaged in transit":  ALERT,
};

export function statusStyle(status: Shipment["status"]): StatusStyle {
  return BY_STATUS[status] ?? NEUTRAL;
}

export function isLive(status: Shipment["status"]): boolean {
  return (
      status === "Processing" ||
      status === "In Transit" ||
      status === "Customs Clearance" ||
      status === "At Warehouse" ||
      status === "Forwarded to Courier"
  );
}

export function modeStyle(mode: Shipment["mode"]): StatusStyle {
  if (mode === "Ocean Freight") return LAVENDER;
  if (mode === "Express Air")   return GREEN;
  return CYAN;
}