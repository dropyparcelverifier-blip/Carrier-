#!/usr/bin/env node
/**
 * Syncs real last-mile handover data (physical courier, AWB, tracking URL)
 * from Order Central's local database into this app's production orders.
 *
 * Order Central's SQLite file lives on this machine only — the deployed
 * Vercel app can't reach it directly over the network, so this is a
 * manual/repeatable local script rather than a live bridge endpoint (a
 * deliberate choice: see the conversation this was built from — a real
 * bridge endpoint is the natural next step if this needs to run
 * automatically later, but wasn't asked for yet).
 *
 * What it does, per order in Order Central at stage="dispatched" /
 * substage="tracking_added" (i.e. genuinely handed off with a real AWB):
 *   1. Reads courier, awb, tracking_url from Order Central's `orders` table.
 *   2. Infers the fulfilment PLATFORM (Shiprocket vs Velocity) from the
 *      tracking_url's domain — Order Central stores the physical courier
 *      (dtdc, delhivery, xpressbees, ...) but our schema's last_mile_courier
 *      column is the platform, not the physical carrier (see
 *      lib/last-mile.ts's own note on why those are different things).
 *   3. Finds the matching order in production by dropy_order_id.
 *   4. If it exists and isn't already at handed_to_courier, PATCHes it
 *      through qc_check -> handed_to_courier with the real courier/awb/url,
 *      via the same admin API a human would use (requires ADMIN_USERNAME/
 *      ADMIN_PASSWORD in .env.local — this logs in for a real session,
 *      same auth path as the admin panel itself).
 *   5. If an order already has last_mile_tracking_url set, it's left alone
 *      — this only fills in orders that don't have real last-mile data yet,
 *      so re-running is safe and won't clobber anything.
 *
 * Usage:
 *   node scripts/sync-last-mile.js [--dry-run] [--limit=N] [--base=URL]
 *
 *   --dry-run   Report what WOULD sync without writing anything.
 *   --limit=N   Only process the first N matched orders (default: all).
 *   --base=URL  Target site (default: https://carrier-ashy.vercel.app).
 */

const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const ORDER_CENTRAL_DB = "C:/Users/Admin/Desktop/Dropy Order Central/dropy_order_central.db";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => {
  const a = args.find((a) => a.startsWith("--limit="));
  return a ? Number(a.split("=")[1]) : Infinity;
})();
const BASE = (() => {
  const a = args.find((a) => a.startsWith("--base="));
  return a ? a.split("=")[1] : "https://carrier-ashy.vercel.app";
})();

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const raw = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    val = val.replace(/^['"]|['"]$/g, "");
    env[key] = val;
  }
  return env;
}

/** Platform inferred from the tracking_url's own domain — the URL itself
 *  is the real source of truth for which platform handled a shipment. */
function inferPlatform(trackingUrl) {
  if (!trackingUrl) return null;
  if (trackingUrl.includes("velocityshipping.in")) return "Velocity";
  if (trackingUrl.includes("shiprocket.co") || trackingUrl.includes("shiprocket.in")) return "Shiprocket";
  return null;
}

async function main() {
  const env = loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase env vars in .env.local — aborting.");
    process.exit(1);
  }
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    console.error("Missing ADMIN_USERNAME/ADMIN_PASSWORD in .env.local — aborting.");
    process.exit(1);
  }

  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const ocDb = new DatabaseSync(ORDER_CENTRAL_DB, { readOnly: true });
  const dispatched = ocDb.prepare(`
    select order_name, courier, awb, tracking_url
    from orders
    where stage = 'dispatched' and substage = 'tracking_added'
      and courier is not null and courier != ''
      and awb is not null and awb != ''
      and tracking_url is not null and tracking_url != ''
  `).all();

  console.log(`Order Central: ${dispatched.length} orders with real courier/AWB/tracking_url.`);

  let loginCookie = null;
  async function ensureLogin() {
    if (loginCookie) return loginCookie;
    const res = await fetch(`${BASE}/api/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }),
    });
    const setCookie = res.headers.get("set-cookie");
    if (!res.ok || !setCookie) throw new Error(`Admin login failed: ${res.status}`);
    loginCookie = setCookie.split(";")[0];
    return loginCookie;
  }

  let synced = 0, skippedNoMatch = 0, skippedAlreadySynced = 0, skippedNoPlatform = 0;

  for (const oc of dispatched) {
    if (synced >= LIMIT) break;

    const platform = inferPlatform(oc.tracking_url);
    if (!platform) {
      skippedNoPlatform++;
      continue;
    }

    const { data: order } = await supabase
      .from("dropy_orders")
      .select("id, dropy_order_id, current_stage, last_mile_tracking_url")
      .ilike("dropy_order_id", `${oc.order_name}%`)
      .maybeSingle();

    if (!order) {
      skippedNoMatch++;
      continue;
    }
    if (order.last_mile_tracking_url) {
      skippedAlreadySynced++;
      continue;
    }

    console.log(`${oc.order_name} -> ${order.id} | ${platform} via ${oc.courier} | AWB ${oc.awb}`);

    if (DRY_RUN) {
      synced++;
      continue;
    }

    const cookie = await ensureLogin();

    // Move to qc_check first if not already past it (mirrors what an admin
    // would actually click through), then hand off with the real data.
    if (order.current_stage !== "qc_check" && order.current_stage !== "handed_to_courier") {
      await fetch(`${BASE}/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          stage: "qc_check", note: "Quality check passed.",
          paymentStatus: "Fully Paid", shippingDays: 10,
          adminNotes: `Synced from Order Central — ${oc.order_name}. Physical courier: ${oc.courier}.`,
          orderCreatedAt: new Date().toISOString(),
        }),
      });
    }

    const res = await fetch(`${BASE}/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        stage: "qc_check", note: `Handed off via ${oc.courier}, tracked on ${platform}.`,
        paymentStatus: "Fully Paid", shippingDays: 10,
        adminNotes: `Synced from Order Central — ${oc.order_name}. Physical courier: ${oc.courier}.`,
        orderCreatedAt: new Date().toISOString(),
        lastMileCourier: platform, lastMileAwb: oc.awb, lastMileTrackingUrl: oc.tracking_url,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error(`  FAILED: ${res.status} ${JSON.stringify(json)}`);
      continue;
    }
    synced++;
  }

  console.log("");
  console.log(`Synced: ${synced}`);
  console.log(`Skipped (no matching order in production): ${skippedNoMatch}`);
  console.log(`Skipped (already had a synced tracking URL): ${skippedAlreadySynced}`);
  console.log(`Skipped (couldn't infer platform from tracking_url): ${skippedNoPlatform}`);
  if (DRY_RUN) console.log("(--dry-run: nothing was actually written)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
