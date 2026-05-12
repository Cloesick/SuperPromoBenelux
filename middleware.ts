import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const pathname = request.nextUrl.pathname;

  if (host === "superpromobelgie.be") {
    const url = request.nextUrl.clone();
    url.host = "www.superpromobelgie.be";
    url.protocol = "https:";
    return NextResponse.redirect(url, 301);
  }

  if (pathname.startsWith("/admin")) {
    const user = process.env.ADMIN_USER;
    const pass = process.env.ADMIN_PASS;

    if (!user || !pass) {
      return new NextResponse("Not found", { status: 404 });
    }

    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Basic ") ? auth.slice("Basic ".length) : null;

    let decoded = "";
    if (token) {
      try {
        decoded = atob(token);
      } catch {
        decoded = "";
      }
    }

    if (decoded !== `${user}:${pass}`) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Admin"',
        },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
