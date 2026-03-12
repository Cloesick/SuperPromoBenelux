import { NextResponse } from "next/server";
import { getAffiliateUrl } from "@/lib/affiliate";
import { getRetailerBySlug } from "@/lib/retailers";

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
  let dest: URL;
  try {
    dest = new URL(affiliateUrl);
  } catch {
    return new NextResponse("Invalid destination", { status: 400 });
  }

  if (dest.protocol !== "http:" && dest.protocol !== "https:") {
    return new NextResponse("Invalid destination", { status: 400 });
  }

  const reqUrl = new URL(request.url);

  // Server-side log for attribution and funnel measurement.
  // We deliberately keep this minimal (no PII) and rely on first-party cookies.
  const attribCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("sp_attrib="));

  const attribSample = attribCookie
    ? attribCookie.slice(0, 80)
    : null;

  console.log(
    JSON.stringify({
      event: "outbound_click",
      retailer,
      affiliateUrl: dest.toString(),
      path: reqUrl.pathname,
      ts: new Date().toISOString(),
      hasAttrib: Boolean(attribCookie),
      attribSample,
    })
  );

  return NextResponse.redirect(dest.toString(), 302);
}
