"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Script from "next/script";

const CONSENT_KEY = "sp_cookie_consent";

function hasConsent(): boolean {
	if (typeof window === "undefined") return false;
	return window.localStorage.getItem(CONSENT_KEY) === "accepted";
}

const VercelAnalytics = dynamic(
	() => import("@vercel/analytics/next").then((m) => m.Analytics),
	{ ssr: false },
);

const VercelSpeedInsights = dynamic(
	() => import("@vercel/speed-insights/next").then((m) => m.SpeedInsights),
	{ ssr: false },
);

export function AnalyticsGate() {
	const [enabled, setEnabled] = useState(false);

	useEffect(() => {
		const update = () => setEnabled(hasConsent());
		update();

		window.addEventListener("storage", update);
		window.addEventListener("sp_consent_changed", update);
		return () => {
			window.removeEventListener("storage", update);
			window.removeEventListener("sp_consent_changed", update);
		};
	}, []);

	useEffect(() => {
		if (!enabled) return;

		const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
		if (!posthogKey) return;

		void import("posthog-js").then(({ default: posthog }) => {
			posthog.init(posthogKey, {
				api_host:
					process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
				capture_pageview: true,
				capture_pageleave: true,
			});
		});
	}, [enabled]);

	if (!enabled) return null;

	const gaId = process.env.NEXT_PUBLIC_GA4_ID;
	const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
	const gtagId = gaId || adsId;

	return (
		<>
			<VercelAnalytics />
			<VercelSpeedInsights />
			{gtagId ? (
				<>
					<Script
						src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
						strategy="afterInteractive"
					/>
					<Script id="gtag-init" strategy="afterInteractive">
						{`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
${gaId ? `gtag('config', '${gaId}', { anonymize_ip: true });\n` : ""}${adsId ? `gtag('config', '${adsId}');\n` : ""}`}
					</Script>
				</>
			) : null}
		</>
	);
}
