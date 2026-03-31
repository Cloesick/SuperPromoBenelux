import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	async rewrites() {
		const ELECTRO_ORIGIN =
			process.env.ELECTRO_APP_ORIGIN || "http://localhost:3001";
		const BEAUTY_ORIGIN =
			process.env.BEAUTY_APP_ORIGIN || "http://localhost:3002";
		const FASHION_ORIGIN =
			process.env.FASHION_APP_ORIGIN || "http://localhost:3003";
		const HOMEGARDEN_ORIGIN =
			process.env.HOMEGARDEN_APP_ORIGIN || "http://localhost:3004";
		const DIY_ORIGIN = process.env.DIY_APP_ORIGIN || "http://localhost:3005";
		const PET_ORIGIN = process.env.PET_APP_ORIGIN || "http://localhost:3006";

		return [
			{
				source: "/electro/:path*",
				destination: `${ELECTRO_ORIGIN}/electro/:path*`,
			},
			{
				source: "/beauty/:path*",
				destination: `${BEAUTY_ORIGIN}/beauty/:path*`,
			},
			{
				source: "/fashion/:path*",
				destination: `${FASHION_ORIGIN}/fashion/:path*`,
			},
			{
				source: "/home-garden/:path*",
				destination: `${HOMEGARDEN_ORIGIN}/home-garden/:path*`,
			},
			{
				source: "/diy/:path*",
				destination: `${DIY_ORIGIN}/diy/:path*`,
			},
			{
				source: "/pet/:path*",
				destination: `${PET_ORIGIN}/pet/:path*`,
			},
		];
	},
	async redirects() {
		return [
			{
				source: "/favicon.ico",
				destination: "/icon.svg",
				permanent: true,
			},
		];
	},
	images: {
		dangerouslyAllowSVG: true,
		contentDispositionType: "attachment",
		contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
		remotePatterns: [
			{
				protocol: "https",
				hostname: "**",
			},
		],
	},
};

export default nextConfig;
