import { NextResponse } from "next/server";
import { isConsentAccepted } from "@/lib/consent";
import { parseAttributionCookie } from "@/lib/attribution";
import { logEventToDb } from "@/lib/eventsDb";
import { getRetailerBySlug } from "@/lib/retailers";

const allowedEvents = new Set([
  "folder_view",
  "folder_engaged_15s",
  "folder_scroll_50",
  "folder_scroll_90",
  "folder_page_turn",
]);

type Payload = {
  event: string;
  retailer?: string;
  path?: string;
};

function parseCookieValue(cookieHeader: string | null, name: string): string | undefined {
  const hit = cookieHeader
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  const v = hit?.split("=")[1];
  return v ? v : undefined;
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!isConsentAccepted(cookieHeader)) {
    return new NextResponse(null, { status: 204 });
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  if (!body || typeof body.event !== "string" || !allowedEvents.has(body.event)) {
    return new NextResponse(null, { status: 204 });
  }

  const retailer = typeof body.retailer === "string" ? body.retailer : undefined;
  if (!retailer || !getRetailerBySlug(retailer)) {
    return new NextResponse(null, { status: 204 });
  }

  const path = typeof body.path === "string" && body.path.startsWith("/folders/") ? body.path : undefined;

  const rawAttrib = parseCookieValue(cookieHeader, "sp_attrib");
  const utm = parseAttributionCookie(rawAttrib);

  await logEventToDb({
    eventName: body.event,
    path,
    retailer,
    utm: utm ?? undefined,
    userAgent: request.headers.get("user-agent"),
    referrer: request.headers.get("referer"),
  });

  return new NextResponse(null, { status: 204 });
}
