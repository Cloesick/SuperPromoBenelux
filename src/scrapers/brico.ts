import { BaseScraper, RetailerConfig } from "./base";

/**
 * Brico had folder data only from the Apify Publitas harvest, and that harvest
 * went stale: the stored leaflet expired on 24 June and its signed PDF link
 * stopped resolving, so the page had nothing to show for six weeks.
 *
 * Brico's own site links the current folder from its homepage — folder.brico.be
 * and /nl/actie/folder-en-promoties — so a scraper of its own keeps it fresh
 * regardless of what the harvest does.
 *
 * folder.brico.be answers 403 to a plain HTTP client, which is why this has to
 * go through the browser rather than a fetch.
 */
export class BricoScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "brico",
		name: "Brico",
		folderTitle: "Brico folder",
		folderUrls: [
			"https://www.brico.be/nl/promotie/folder-en-promoties",
			"https://www.brico.be/nl/promotie",
			// The viewer root, which 302s to the current issue.
			"https://folder.brico.be/nl",
			"https://folder.brico.be/",
		],
		dealUrls: ["https://www.brico.be/nl/promotie"],
		cookieSelectors: ["#onetrust-accept-btn-handler"],
		priceSelectors: {
			card: "[data-testid*='product'], [class*='product'], [class*='Product'], article, li",
			name: "[data-testid*='product-title'], [class*='title'], [class*='Title'], h2, h3, h4",
			originalPrice: "[class*='was'], [class*='old'], [class*='strike'], del, s",
			promoPrice: "[data-testid*='price'], [class*='price'], [class*='Price']",
			discount: "[class*='discount'], [class*='badge'], [class*='label']",
			image: "img",
		},
		folderLinkPatterns: [
			/^https:\/\/folder\.brico\.be\//i,
			/^https:\/\/view\.publitas\.com\//i,
		],
	};
}
