import { NextResponse } from "next/server";
import { getQueriesDb, validateQuery, type QueryInput } from "@/lib/queries-db";

export const dynamic = "force-dynamic";

const MAX_PER_EMAIL_PER_HOUR = 3;
const MAX_PER_IP_PER_HOUR = 10;

/**
 * Enquiry form submissions.
 *
 * Rate limited in the DATABASE rather than in memory. Vercel runs this on
 * serverless functions with no shared state between invocations, so an
 * in-memory counter would reset constantly and limit nothing. Counting
 * rows from the last hour is the only limit that actually holds.
 *
 * No CAPTCHA: it costs a third-party script on every page load and a
 * measurable share of genuine submissions. Rate limiting plus a honeypot
 * catches the traffic this form will realistically see.
 */
export async function POST(request: Request) {
  try {
    const db = getQueriesDb();
    if (!db) {
      return NextResponse.json(
        { error: "The form isn't available right now. Please email us instead." },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    // Honeypot. A field hidden from people, filled in by most bots. If it
    // has anything in it, accept the request and discard it — telling a
    // bot it failed just teaches it to try differently.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return NextResponse.json({ ok: true });
    }

    const invalid = validateQuery(body);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const email = String(body.email).trim().toLowerCase();
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      null;

    const hourAgo = new Date(Date.now() - 3600_000).toISOString();

    const [byEmail, byIp] = await Promise.all([
      db.from("business_queries").select("id", { count: "exact", head: true })
        .eq("email", email).gte("created_at", hourAgo),
      ip
        ? db.from("business_queries").select("id", { count: "exact", head: true })
            .eq("source_ip", ip).gte("created_at", hourAgo)
        : Promise.resolve({ count: 0 }),
    ]);

    if ((byEmail.count ?? 0) >= MAX_PER_EMAIL_PER_HOUR || (byIp.count ?? 0) >= MAX_PER_IP_PER_HOUR) {
      return NextResponse.json(
        { error: "You've sent a few already. Give us a chance to reply, or email us directly." },
        { status: 429 },
      );
    }

    const input: QueryInput = {
      business_name: String(body.business_name).trim(),
      business_desc: body.business_desc ? String(body.business_desc).trim() : null,
      contact_name: body.contact_name ? String(body.contact_name).trim() : null,
      email,
      phone: body.phone ? String(body.phone).trim() : null,
      subject: String(body.subject).trim(),
      body: String(body.body).trim(),
    };

    const { error } = await db.from("business_queries").insert({
      ...input,
      source_ip: ip,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    });

    if (error) {
      console.error("[enquiry] insert failed:", error.message);
      return NextResponse.json(
        { error: "Couldn't save that. Please email us instead." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[enquiry] uncaught:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
