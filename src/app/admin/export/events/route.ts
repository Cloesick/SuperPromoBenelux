import { NextResponse } from "next/server";
import { getEventsForExport } from "@/lib/eventsDb";

function escapeCsvCell(v: unknown): string {
  const s = String(v ?? "");
  if (/[\n\r",]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const event = url.searchParams.get("event") ?? undefined;
  const utmContent = url.searchParams.get("utm_content") ?? undefined;
  const retailer = url.searchParams.get("retailer") ?? undefined;
  const days = url.searchParams.get("days");
  const limit = url.searchParams.get("limit");

  const events = await getEventsForExport({
    eventName: event,
    utmContent,
    retailer,
    days: days ? Number(days) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  const header = [
    "created_at",
    "event_name",
    "path",
    "retailer",
    "destination_url",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
  ];

  const lines = [header.join(",")];
  for (const e of events) {
    lines.push(
      [
        e.created_at,
        e.event_name,
        e.path,
        e.retailer,
        e.destination_url,
        e.utm_source,
        e.utm_medium,
        e.utm_campaign,
        e.utm_content,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  const body = lines.join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=sp_events.csv",
      "Cache-Control": "no-store",
    },
  });
}
