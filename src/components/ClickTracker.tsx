"use client";

import { useEffect } from "react";

// Lightweight, consent-gated click tracking via event delegation.
// Fires GA4 events on outbound retailer clicks (/out/<slug>) and external links,
// so clicks show up in GA4 and can be marked as conversions / imported into
// Google Ads. No per-component wiring needed.

const CONSENT_KEY = "sp_cookie_consent";

function hasConsent(): boolean {
	if (typeof window === "undefined") return false;
	return window.localStorage.getItem(CONSENT_KEY) === "accepted";
}

export function ClickTracker() {
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (!hasConsent()) return;
			const target = e.target as HTMLElement | null;
			const a = target?.closest?.("a") as HTMLAnchorElement | null;
			if (!a) return;
			const href = a.getAttribute("href") || "";
			const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
			if (typeof gtag !== "function") return;

			const out = href.match(/^\/out\/([^/?#]+)/);
			if (out) {
				gtag("event", "retailer_click", {
					retailer: out[1],
					link_url: href,
					outbound: true,
				});
				return;
			}
			try {
				const u = new URL(href, window.location.href);
				if (u.host && u.host !== window.location.host) {
					gtag("event", "outbound_click", {
						link_domain: u.host,
						link_url: u.href,
						outbound: true,
					});
				}
			} catch {
				/* ignore non-URL hrefs */
			}
		};
		document.addEventListener("click", handler, { capture: true });
		return () => document.removeEventListener("click", handler, { capture: true });
	}, []);

	return null;
}
