import {
	BaseScraper,
	RetailerConfig,
	ScrapeContext,
	DealResult,
} from "./base";
import { dealsFromLidlGrid, lidlGridBlocks } from "./lidlGridDeals";

/**
 * Pad a number to 2 digits.
 */
function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

/**
 * Generate Lidl folder-nl.lidl.be URLs for the current and next week.
 * Lidl folders run Monday–Saturday and use the pattern
 *   folder-nl.lidl.be/nl-folder-DD-MM-DD-MM
 */
function getLidlFolderUrls(): string[] {
	const now = new Date();
	const day = now.getDay(); // 0=Sun … 6=Sat
	// Find this week's Monday (day 1). If Sun (0), go back 6 days.
	const diffToMon = day === 0 ? -6 : 1 - day;
	const monday = new Date(now);
	monday.setDate(monday.getDate() + diffToMon);

	const urls: string[] = [];
	for (const offset of [0, 7, -7]) {
		const start = new Date(monday);
		start.setDate(start.getDate() + offset);
		const end = new Date(start);
		end.setDate(end.getDate() + 5); // Saturday
		urls.push(
			`https://folder-nl.lidl.be/nl-folder-${pad2(start.getDate())}-${pad2(start.getMonth() + 1)}-${pad2(end.getDate())}-${pad2(end.getMonth() + 1)}`,
		);
	}
	return urls;
}

export class LidlScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "lidl",
		name: "Lidl",
		folderTitle: "Lidl folder van de week",
		// lidl.be/nl/aanbiedingen has 404'd since at least Aug 2026, so the deal
		// pass was reading nav links off an error page and the harvest guard threw
		// the whole run away. The weekly promo page is now /c/nl-BE/acties-deze-week/;
		// the older aanbiedingen-deze-week slug 301s onto it, kept as a hedge.
		folderUrls: [
			"https://www.lidl.be/c/nl-BE/folders-magazines/s10008101",
			"https://www.lidl.be/c/nl-BE/acties-deze-week/a10082242",
			...getLidlFolderUrls(),
		],
		dealUrls: [
			"https://www.lidl.be/c/nl-BE/acties-deze-week/a10082242",
			"https://www.lidl.be/c/nl-BE/aanbiedingen-deze-week/a10082242",
			"https://www.lidl.be/c/nl-BE/weekenddeals/a10077355",
		],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="cookie-alert--accept"]',
		],
		folderLinkPatterns: [/folder-nl\.lidl\.be\//],
		priceSelectors: {
			card: '[class*="product"], [class*="ACampaignGrid"] > div, [class*="offer-card"], [class*="ATheHeroStage"]',
			name: '[class*="product-name"], [class*="title"], h3, h4, [class*="keyfact"]',
			originalPrice: '[class*="strikethrough"], [class*="old-price"], del, s',
			promoPrice: '[class*="price"], [class*="m-price"]',
			discount: '[class*="discount"], [class*="badge"], [class*="saving"]',
			image: 'img[src*="product"], img[class*="product"], picture img',
		},
	};

	// Lidl ships no product JSON-LD and keeps prices out of the DOM, so the base
	// pass finds nothing on the weekly promo page. Read the `data-grid-data`
	// payload as well and merge, rather than replacing: the base pass still
	// catches Organization/Offer markup on the folder-landing pages.
	protected async extractJsonLd(ctx: ScrapeContext): Promise<DealResult> {
		const base = await super.extractJsonLd(ctx);

		const html = await ctx.page.content();
		const dates = this.getCurrentWeekDates();
		const grid = dealsFromLidlGrid(lidlGridBlocks(html), {
			retailerSlug: this.retailerSlug,
			validFrom: dates.from,
			validUntil: dates.until,
		});

		if (grid.length > 0)
			this.log(`Extracted ${grid.length} deal(s) from data-grid-data`);

		const seen = new Set(base.deals.map((d) => d.product.toLowerCase()));
		const merged = [
			...base.deals,
			...grid.filter((d) => !seen.has(d.product.toLowerCase())),
		];

		return { deals: merged, source: base.source };
	}

}
