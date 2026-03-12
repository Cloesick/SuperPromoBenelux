import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  // Force a single canonical host for the production domain.
  // This improves SEO consistency and stabilizes first-party cookies for attribution.
  if (host === "superpromobelgie.be") {
    const url = request.nextUrl.clone();
    url.host = "www.superpromobelgie.be";
    url.protocol = "https:";
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
