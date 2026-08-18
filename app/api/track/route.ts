import { NextResponse } from "next/server";
import { searchShipments } from "@/lib/shipment-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const phone = url.searchParams.get("phone") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ shipments: [], source: "demo", query: q });
  }

  const { shipments, source } = await searchShipments(q, {
    allowNameSearch: false,
    phone: phone || undefined,
  });
  return NextResponse.json({ shipments, source, query: q });
}
