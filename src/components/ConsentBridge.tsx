"use client";

import { useEffect } from "react";
import { persistConsentChoice, subscribeToCmpConsent } from "@/lib/consent";

/**
 * Relays Google's CMP decision into `sp_cookie_consent`.
 *
 * Google's CMP owns the consent dialog, but it announces the result on the IAB
 * TCF `__tcfapi` channel, which nothing else in this app speaks. Rather than
 * teach every gate a second protocol, this listens once and writes the answer
 * to the key they already read — so AnalyticsGate, MetaPixelGate, ClickTracker
 * and the cookie-reading API routes need no changes at all.
 *
 * Renders nothing.
 */
export function ConsentBridge() {
	useEffect(() => {
		/* The CMP script usually installs `__tcfapi` before hydration, but it is
		 * third-party and can land late. Poll briefly so a slow CMP still gets
		 * picked up, instead of silently never subscribing. */
		let unsubscribe: (() => void) | undefined;
		let cancelled = false;

		const attach = () => {
			if (cancelled || unsubscribe) return true;
			const stop = subscribeToCmpConsent((granted) => {
				persistConsentChoice(granted ? "accepted" : "declined");
			});
			/* subscribeToCmpConsent hands back a no-op when no CMP is present, so
			 * only treat it as attached once one actually exists. */
			if (!isAttached()) return false;
			unsubscribe = stop;
			return true;
		};

		const isAttached = () =>
			typeof window !== "undefined" &&
			typeof (window as unknown as { __tcfapi?: unknown }).__tcfapi ===
				"function";

		if (!attach()) {
			const timer = setInterval(() => {
				if (attach()) clearInterval(timer);
			}, 300);
			/* Give up after 10s: no CMP is coming, and CookieConsent's fallback
			 * banner will have taken over by then. */
			const giveUp = setTimeout(() => clearInterval(timer), 10_000);

			return () => {
				cancelled = true;
				clearInterval(timer);
				clearTimeout(giveUp);
				unsubscribe?.();
			};
		}

		return () => {
			cancelled = true;
			unsubscribe?.();
		};
	}, []);

	return null;
}
