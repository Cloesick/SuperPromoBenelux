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
 * Generate AH bonus-week folder URLs for the current, next, and previous
 * weeks so the scraper can reach the folder even if the main index page
 * does not expose a direct link.
 */
function getAhBonusWeekUrls(): string[] {
	const { week, year } = getIsoWeek(new Date());
	const urls: string[] = [];
	for (const w of [week, week + 1, week - 1]) {
		if (w > 0 && w <= 53) {
			urls.push(`https://www.ah.be/bonus/folder/bonus-week-${w}-${year}`);
		}
	}
	return urls;
}

export class AlbertHeijnScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "albert-heijn",
		name: "Albert Heijn",
		folderTitle: "Albert Heijn Bonusfolder",
		folderUrls: [
			"https://www.ah.be/bonus/folder",
			"https://www.ah.be/bonus",
			...getAhBonusWeekUrls(),
		],
		dealUrls: ["https://www.ah.be/bonus"],
		cookieSelectors: [
			"#accept-cookies",
			'button[data-testid="cookie-dialog-accept"]',
		],
		folderLinkPatterns: [/ah\.be\/bonus\/folder\/bonus-week-/],
		priceSelectors: {
			card: '[class*="product-card"], [class*="bonus-card"], [class*="promotion"], [data-testhook*="product"]',
			name: '[class*="title"], [class*="name"], h3, h4',
			originalPrice:
				'[class*="was-price"], [class*="old-price"], [class*="original"], del, s',
			promoPrice:
				'[class*="price-now"], [class*="new-price"], [class*="promo-price"], [class*="bonus-price"]',
			discount: '[class*="discount"], [class*="savings"], [class*="badge"]',
			image: 'img[src*="product"], img[class*="product"]',
		},
	};
}
