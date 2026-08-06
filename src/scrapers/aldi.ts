import { BaseScraper, RetailerConfig } from "./base";

/**
 * Compute ISO-8601 week number for a given date.
 */
function getIsoWeek(d: Date): { week: number; year: number } {
	const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
	const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
	const week = Math.ceil(
		((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
	);
	return { week, year: date.getUTCFullYear() };
}

/**
 * Generate ALDI viewer URLs for the current, next, and previous weeks.
 *
 * Pattern: folder.aldi.be/import-folder/{YEAR}/{YY}{WW}-nl-mag/
 * e.g. week 32 of 2026 → folder.aldi.be/import-folder/2026/2632-nl-mag/
 *
 * The `-mag` suffix is what www.aldi.be actually iframes; the bare `-nl`
 * publication also resolves and is kept as a second guess per week because the
 * suffix has changed before.
 */
function getAldiFolderUrls(): string[] {
	const { week, year } = getIsoWeek(new Date());
	const yy = String(year).slice(-2);
	const urls: string[] = [];
	for (const w of [week, week + 1, week - 1]) {
		if (w > 0 && w <= 53) {
			const ww = String(w).padStart(2, "0");
			urls.push(
				`https://folder.aldi.be/import-folder/${year}/${yy}${ww}-nl-mag/`,
				`https://folder.aldi.be/import-folder/${year}/${yy}${ww}-nl/`,
			);
		}
	}
	return urls;
}

export class AldiScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "aldi",
		name: "ALDI",
		folderTitle: "ALDI folder van de week",
		// The `/nl/` prefixed paths this used to carry are gone: aldi.be now
		// redirects them to `/onze-folders/…`, which returns 404 behind a fully
		// rendered chrome. The scraper cannot tell that apart from a real page, so
		// it happily screenshotted "De gevraagde pagina kon helaas niet gevonden
		// worden" every run. These are the paths the site's own navigation links.
		folderUrls: [
			"https://www.aldi.be/folders/folder-van-deze-week.html",
			"https://www.aldi.be/folders/folder-van-volgende-week.html",
			"https://www.aldi.be/folders.html",
			...getAldiFolderUrls(),
		],
		dealUrls: [
			"https://www.aldi.be/folders/folder-van-deze-week.html",
			"https://www.aldi.be/aanbiedingen.html",
		],
		// ALDI BE runs Usercentrics, whose dialog lives in the #usercentrics-root
		// shadow tree. Shadow traversal alone is not enough: the buttons are
		// labelled in Belgian Dutch — "Alle cookies aanvaarden" (not
		// "accepteren") and "Alle niet strikt noodzakelijke cookies en/of andere
		// technologieën weigeren" — so no entry in the shared CONSENT_TEXTS list
		// matches them exactly and the dialog survived every capture. The
		// data-testid attributes Usercentrics ships are stable and unambiguous.
		// Deny is listed first so the scraper declines tracking rather than
		// accepting it; base.ts tries configured selectors in order.
		cookieSelectors: [
			'[data-testid="uc-deny-all-button"]',
			'[data-testid="uc-accept-all-button"]',
			"#onetrust-accept-btn-handler",
		],
		folderLinkPatterns: [/folder\.aldi\.be\//],
		priceSelectors: {
			card: '[class*="product"], [class*="tile"], [class*="card"], article',
			name: '[class*="product-name"], [class*="title"], h3, h4',
			originalPrice: '[class*="old-price"], [class*="was-price"], del, s',
			promoPrice: '[class*="price"], [class*="new-price"]',
			discount: '[class*="discount"], [class*="badge"], [class*="saving"]',
			image: 'img[src*="product"], img[class*="product"], picture img',
		},
	};
}
