import { BaseScraper, RetailerConfig } from "./base";

export class MaxiZooScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "maxi-zoo",
		name: "Maxi Zoo",
		folderTitle: "Maxi Zoo promoties",
		// Both previously configured URLs (/nl/promoties and /nl/aanbiedingen)
		// were 404s, which is why this scraper never wrote a data file: every
		// navigation failed, so the screenshot fallback had no page to capture and
		// run() bailed before the JSON write. Maxi Zoo files its offers under
		// /nl/acties-aanbiedingen/ instead.
		folderUrls: [
			"https://www.maxizoo.be/nl/acties-aanbiedingen/folder/",
			// The viewer itself, in case the folder page stops linking it.
			"https://flyer.maxizoo.be/flyer/flyernl/",
			"https://www.maxizoo.be/nl/acties-aanbiedingen/",
		],
		dealUrls: [
			"https://www.maxizoo.be/nl/acties-aanbiedingen/maxi-deals/",
			"https://www.maxizoo.be/nl/acties-aanbiedingen/",
		],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="accept"]',
		],
		// The folder page only links the leaflet ("Blader nu" → flyer.maxizoo.be);
		// it does not iframe it. Without a pattern, findFolderLink's generic
		// keyword pass can match the page's own /folder/ nav link first, which the
		// already-visited check treats as a dead end — so the viewer is never
		// reached. Same arrangement as Kruidvat (folder.kruidvat.be) and ALDI
		// (folder.aldi.be).
		folderLinkPatterns: [/^https:\/\/flyer\.maxizoo\.be\//i],
		priceSelectors: {
			card: "[data-testid*='product'], [class*='product'], article, li",
			name: "[data-testid*='product-title'], [class*='title'], h2, h3, h4",
			originalPrice: "[class*='was'], [class*='old'], del, s",
			promoPrice: "[data-testid*='price'], [class*='price']",
			discount: "[class*='discount'], [class*='badge'], [class*='label']",
			image: "img",
		},
	};
}
