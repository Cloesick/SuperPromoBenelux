import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: `output: "export"` was removed — the /api/attribution, /api/engagement
  // and /api/inspector routes are dynamic server handlers (write to Neon / read
  // the filesystem) and cannot be statically exported. Deploy as a standard
  // Next app on Vercel (serverless functions). AdSense only needs a custom
  // domain, not static export.
  trailingSlash: true,
  images: {
    unoptimized: true,
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
