import { NextResponse } from "next/server";
import { requireAdminIdentity } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

/**
 * Who am I — used by the admin UI to decide which controls to render.
 *
 * This is a CONVENIENCE, not a security boundary. Every privileged route
 * checks the role independently on the server; hiding a button the API
 * would reject anyway is courtesy to the user, not protection. Anyone can
 * call this endpoint and lie to their own browser about the response —
 * it changes nothing about what the server will accept.
 */
export async function GET() {
  try {
    const identity = await requireAdminIdentity();
    if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json({
      username: identity.username,
      role: identity.role,
    });
  } catch (err: any) {
    console.error("Uncaught GET /api/admin/me error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
