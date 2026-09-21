"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

/**
 * Social ad pixels: Meta, TikTok and Pinterest.
 *
 * Replaces MetaPixelGate, which was written but never mounted, so the Meta
 * pixel had never once loaded. Each pixel needs two things before it loads:
 * marketing consent (the same `sp_cookie_consent` key ConsentBridge fills from
 * Google's CMP) and its id in the environment. A pixel with no id renders
 * nothing, so adding a platform is a Vercel env var, not a deploy of code.
 *
 *   NEXT_PUBLIC_META_PIXEL_ID       Meta Events Manager → Data sources
 *   NEXT_PUBLIC_TIKTOK_PIXEL_ID     TikTok Ads Manager → Events → Web events
 *   NEXT_PUBLIC_PINTEREST_TAG_ID    Pinterest Ads → Conversions → Tag manager
 *
 * The site is a client-side app after the first load, so each pixel's own
 * snippet only ever records the landing page. Route changes are reported here,
 * once per pathname, so a visit that reads five folders counts five pages.
 */

const CONSENT_KEY = "sp_cookie_consent";

function hasConsent(): boolean {
	if (typeof window === "undefined") return false;
	try {
		return window.localStorage.getItem(CONSENT_KEY) === "accepted";
	} catch {
		return false;
	}
}

type Pixel = (...args: unknown[]) => void;
type PixelWindow = Window & {
	fbq?: Pixel;
	ttq?: { page: () => void };
	pintrk?: Pixel;
};

const META_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const TIKTOK_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
const PINTEREST_ID = process.env.NEXT_PUBLIC_PINTEREST_TAG_ID;

// Ids go into inline script text, so accept only what the platforms issue.
const safe = (id: string | undefined, re: RegExp) => (id && re.test(id) ? id : undefined);
const metaId = safe(META_ID, /^\d{6,20}$/);
const tiktokId = safe(TIKTOK_ID, /^[A-Z0-9]{10,30}$/);
const pinterestId = safe(PINTEREST_ID, /^\d{6,20}$/);

export function SocialPixels() {
	const [enabled, setEnabled] = useState(false);
	const pathname = usePathname();
	const lastTracked = useRef<string | null>(null);

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
		if (!enabled || !pathname) return;
		// The first page is recorded by each snippet's own init call.
		if (lastTracked.current === null) {
			lastTracked.current = pathname;
			return;
		}
		if (lastTracked.current === pathname) return;
		lastTracked.current = pathname;

		const w = window as PixelWindow;
		w.fbq?.("track", "PageView");
		w.ttq?.page();
		w.pintrk?.("page");
	}, [enabled, pathname]);

	if (!enabled) return null;

	return (
		<>
			{metaId ? (
				<Script id="meta-pixel" strategy="afterInteractive">
					{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${metaId}');fbq('track','PageView');`}
				</Script>
			) : null}

			{tiktokId ? (
				<Script id="tiktok-pixel" strategy="afterInteractive">
					{`!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${tiktokId}');ttq.page();}(window, document, 'ttq');`}
				</Script>
			) : null}

			{pinterestId ? (
				<Script id="pinterest-tag" strategy="afterInteractive">
					{`!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load','${pinterestId}');pintrk('page');`}
				</Script>
			) : null}
		</>
	);
}
