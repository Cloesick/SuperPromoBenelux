import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// NOTE: `output: "export"` removed — this app has dynamic routes
	// (/robots.txt, /sitemap.xml, /ads.txt, /api/*, /out/*) that can't be
	// statically exported. Deploys as a standard Next app on Vercel.
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
	// Folder data is read from disk at request time by src/lib/folders.ts, so
	// the JSON must be traced into the serverless functions that read it.
	// Without this every retailer page degrades to "geen folder beschikbaar" —
	// a graceful-looking state that hides a packaging failure.
	//
	// The key is "/**", not "/*": the reading routes are /folders/[retailer]
	// and /folders/[retailer]/p/[page], and a single-star glob matches only one
	// path segment.
	outputFileTracingIncludes: {
		"/**": ["./data/folders/*.json"],
	},
};

export default nextConfig;
