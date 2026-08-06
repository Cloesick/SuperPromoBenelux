// ---------------------------------------------------------------------------
// Recognise a bot-challenge / WAF block page.
//
// The original checks were all Dutch and Colruyt-specific, so Imperva's English
// block page sailed through: Boots' folder page 1 is an Incapsula block, it was
// screenshotted, OCR'd, and stored as a deal priced EUR 45.60 down from EUR
// 193.74 — both numbers sliced out of the IP addresses printed on the block
// page. Those three rows are the only Boots data in the price database.
//
// Kept as a pure predicate rather than inline in BaseScraper so it can be
// tested against the real block-page copy without driving a browser.
// ---------------------------------------------------------------------------

/**
 * Phrases that only appear on a challenge or block page.
 *
 * Deliberately long and specific. A false positive aborts the scrape and drops
 * that retailer's folder entirely, so bare words like "blocked" or "denied" are
 * not used — they occur in ordinary product and returns-policy copy.
 */
const CHALLENGE_PHRASES = [
	// Dutch / Colruyt
	"sorry voor de onderbreking",
	"je een bot",
	"onmiddellijk weer toegang",
	"colruytgroup",
	// Generic challenge widgets
	"click to verify",
	"captcha",
	// Imperva / Incapsula
	"access to this site is not possible",
	"blocked by our security service",
	"incident id",
	// Cloudflare / generic WAF
	"attention required",
	"access denied",
	"please enable cookies and reload the page",
];

/**
 * URL fragments that only ever belong to a challenge endpoint. A leaflet URL
 * never contains these, so they are safe to treat as conclusive.
 */
const CHALLENGE_URL_FRAGMENTS = ["_incapsula_resource", "/cdn-cgi/"];

/**
 * True when the page body or URL identifies a bot challenge or WAF block.
 */
export function looksLikeBotChallenge(bodyText: string, url = ""): boolean {
	const haystack = String(bodyText ?? "").toLowerCase();
	for (const phrase of CHALLENGE_PHRASES) {
		if (haystack.includes(phrase)) return true;
	}

	const target = String(url ?? "").toLowerCase();
	for (const fragment of CHALLENGE_URL_FRAGMENTS) {
		if (target.includes(fragment)) return true;
	}

	return false;
}
