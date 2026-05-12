"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const CONSENT_KEY = "sp_cookie_consent";

function hasConsent(): boolean {
	if (typeof window === "undefined") return false;
	return window.localStorage.getItem(CONSENT_KEY) === "accepted";
}

export function AdSenseGate() {
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

	const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
	if (!enabled) return null;
	if (!client) return null;

	return (
		<Script
			id="adsense"
			async
			strategy="afterInteractive"
			src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
			crossOrigin="anonymous"
		/>
	);
}
