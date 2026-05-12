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
 * Generate Delhaize Publitas folder URLs for the current, next, and previous
 * weeks.  Pattern: view.publitas.com/delhaize-belgium-nl/w{WEEK}-{YEAR}-nl/
 */
function getDelhaizeWeekUrls(): string[] {
	const { week, year } = getIsoWeek(new Date());
	const urls: string[] = [];
	for (const w of [week, week + 1, week - 1]) {
		if (w > 0 && w <= 53) {
			urls.push(
				`https://view.publitas.com/delhaize-belgium-nl/w${w}-${year}-nl/page/1`,
			);
		}
	}
	return urls;
}

export class DelhaizeScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "delhaize",
		name: "Delhaize",
		folderTitle: "Delhaize folder van de week",
		folderUrls: [
			"https://www.delhaize.be/nl/folder",
			"https://www.delhaize.be/folderpage",
			"https://www.delhaize.be/nl/promoties",
			...getDelhaizeWeekUrls(),
		],
		dealUrls: [
			"https://www.delhaize.be/nl/promoties",
			"https://www.delhaize.be/nl/Promolandingpage",
		],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="accept"]',
		],
		folderLinkPatterns: [/view\.publitas\.com\/delhaize/],
		priceSelectors: {
			card: '[class*="product-card"], [class*="promo-card"], [class*="promotion-item"], [class*="tile"]',
			name: '[class*="product-name"], [class*="title"], h3, h4',
			originalPrice: '[class*="old-price"], [class*="was-price"], del, s',
			promoPrice:
				'[class*="price"], [class*="new-price"], [class*="promo-price"]',
			discount:
				'[class*="discount"], [class*="savings"], [class*="badge"], [class*="reduction"]',
			image: 'img[src*="product"], img[class*="product"], picture img',
		},
	};
}
