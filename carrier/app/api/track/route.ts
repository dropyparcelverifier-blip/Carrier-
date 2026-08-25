import { NextResponse } from "next/server";
import { searchShipments } from "@/lib/shipment-service";
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const phone = url.searchParams.get("phone") ?? "";

    if (!q.trim()) {
      return NextResponse.json({ shipments: [], source: "demo", query: q });
    }

    // H1 — The 10-digit check in TrackClient.tsx is a UX affordance, not a
    // security boundary — this route is. Without this, GET /api/track?q=<id>
    // with no phone param returns the full order row (name, mobile, city,
    // items, declared value) to anyone who guesses a sequential tracking ID.
    if (!/^\d{10}$/.test(phone.trim())) {
      return NextResponse.json(
        { error: "A 10-digit registered phone number is required." },
        { status: 400 },
      );
    }

    const limitKey = clientIp(request);
    const limit = checkRateLimit(limitKey);
    if (limit.limited) {
      const minutes = Math.ceil(limit.retryAfterSeconds / 60);
      return NextResponse.json(
        { error: `Too many requests. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
        { status: 429 },
      );
    }

    const { shipments, source } = await searchShipments(q, {
      allowNameSearch: false,
      phone: phone || undefined,
    });

    // Only a genuine miss (wrong ID/phone guess) counts against the limit —
    // this endpoint has no login/session to protect, so the real risk is
    // someone brute-forcing phone numbers against a known tracking ID, not
    // a legitimate customer checking their own order more than once. A
    // successful lookup clears the counter entirely, so re-checking an
    // order repeatedly (completely normal behavior) never locks anyone out.
    if (shipments.length > 0) {
      clearRateLimit(limitKey);
    } else {
      recordFailedAttempt(limitKey);
    }

    return NextResponse.json({ shipments, source, query: q });
  } catch (err: any) {
    console.error("Uncaught GET /api/track error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
