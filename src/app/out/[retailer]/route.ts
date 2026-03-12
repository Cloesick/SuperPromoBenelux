import { NextResponse } from "next/server";
import { getAffiliateUrl } from "@/lib/affiliate";
import { getRetailerBySlug } from "@/lib/retailers";
import { isConsentAccepted } from "@/lib/consent";
import { parseAttributionCookie } from "@/lib/attribution";
import { logEventToDb } from "@/lib/eventsDb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ retailer: string }> }
) {
  const { retailer } = await params;
  const known = getRetailerBySlug(retailer);
  if (!known) {
    return new NextResponse("Not found", { status: 404 });
  }

  const affiliateUrl = getAffiliateUrl(retailer);
  const rawDestination = affiliateUrl === "#" ? known.website : affiliateUrl;
  let dest: URL;
  try {
    dest = new URL(rawDestination);
  } catch {
    return new NextResponse("Invalid destination", { status: 400 });
  }

  if (dest.protocol !== "http:" && dest.protocol !== "https:") {
    return new NextResponse("Invalid destination", { status: 400 });
  }

  const reqUrl = new URL(request.url);

  const cookieHeader = request.headers.get("cookie");
  if (isConsentAccepted(cookieHeader)) {
    const rawAttrib = cookieHeader
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("sp_attrib="))
      ?.split("=")[1];

    const utm = parseAttributionCookie(rawAttrib ?? undefined);

    await logEventToDb({
      eventName: "outbound_click",
      path: reqUrl.pathname,
      retailer,
      destinationUrl: dest.toString(),
      utm: utm ?? undefined,
      userAgent: request.headers.get("user-agent"),
      referrer: request.headers.get("referer"),
    });
  }

  return NextResponse.redirect(dest.toString(), 302);
}
