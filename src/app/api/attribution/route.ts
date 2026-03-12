import { NextResponse } from "next/server";
import { isConsentAccepted } from "@/lib/consent";
import { logEventToDb } from "@/lib/eventsDb";

function getUtmParams(url: URL) {
  const keys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ] as const;

  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = url.searchParams.get(k);
    if (v) out[k] = v;
  }
  return out;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const utm = getUtmParams(url);

  const cookieHeader = request.headers.get("cookie");
  if (!isConsentAccepted(cookieHeader)) {
    return new NextResponse(null, { status: 204 });
  }

  if (Object.keys(utm).length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  const payload = {
    ...utm,
    first_seen_ts: new Date().toISOString(),
  };

  const encoded = encodeURIComponent(JSON.stringify(payload));
  // Guardrail: prevent unbounded cookie sizes.
  if (encoded.length > 1500) {
    return new NextResponse(null, { status: 204 });
  }

  const res = new NextResponse(null, { status: 204 });
  res.cookies.set({
    name: "sp_attrib",
    value: encoded,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  await logEventToDb({
    eventName: "attribution_set",
    path: url.pathname,
    utm: {
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content,
    },
    userAgent: request.headers.get("user-agent"),
    referrer: request.headers.get("referer"),
  });

  return res;
}
