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
};

export default nextConfig;
