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
 * Generate ALDI folder URLs for the current, next, and previous weeks.
 * Pattern: folder.aldi.be/import-folder/{YEAR}/{YY}{WW}-nl
 * e.g. week 15 of 2026 → folder.aldi.be/import-folder/2026/2615-nl
 */
function getAldiFolderUrls(): string[] {
	const { week, year } = getIsoWeek(new Date());
	const yy = String(year).slice(-2);
	const urls: string[] = [];
	for (const w of [week, week + 1, week - 1]) {
		if (w > 0 && w <= 53) {
			const ww = String(w).padStart(2, "0");
			urls.push(`https://folder.aldi.be/import-folder/${year}/${yy}${ww}-nl`);
		}
	}
	return urls;
}

export class AldiScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "aldi",
		name: "ALDI",
		folderTitle: "ALDI folder van de week",
		folderUrls: [
			"https://www.aldi.be/nl/onze-folders/folder-van-deze-week.html",
			"https://www.aldi.be/nl/onze-folders.html",
			...getAldiFolderUrls(),
		],
		dealUrls: ["https://www.aldi.be/nl/onze-folders/folder-van-deze-week.html"],
		cookieSelectors: ["#onetrust-accept-btn-handler"],
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
