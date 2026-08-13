import Script from "next/script";

/**
 * Loads the AdSense tag. Deliberately ungated.
 *
 * This used to wait for `sp_cookie_consent`, which deadlocks against Google's
 * CMP: the consent dialog is delivered by Google's own tag, so holding the tag
 * back until the user consents means the dialog never appears, the user can
 * never consent, and the tag never loads. Nothing renders and nothing earns.
 *
 * Loading it immediately is also what makes consent work. The tag is TCF-aware:
 * it reads the CMP's signal itself and withholds personalized ads and ad
 * storage until purpose consent is granted. Consent is enforced inside the tag,
 * not by whether we let it onto the page.
 *
 * ConsentBridge mirrors the CMP's answer into `sp_cookie_consent` so the rest of
 * the app (analytics, pixel, the cookie-reading API routes) still has a signal
 * to gate on.
 */
export function AdSenseGate() {
	// Baked AdSense publisher id; env NEXT_PUBLIC_ADSENSE_CLIENT overrides if set.
	const client =
		process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-3766515514893974";
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
