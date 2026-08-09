import { BaseScraper, RetailerConfig } from "./base";

export class EtosScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "etos",
		name: "Etos",
		folderTitle: "Etos promoties",
		folderUrls: [
			// Etos publishes a real leaflet on Publitas — found by
			// scripts/discover-folder-sources.mts. Its own /folder page 403s to
			// automation, which is why this was only ever a promo-page screenshot.
			"https://view.publitas.com/etos/",
			"https://www.etos.nl/aanbiedingen",
			"https://www.etos.nl/folder",
			"https://www.etos.nl/acties",
		],
		dealUrls: [
			"https://www.etos.nl/aanbiedingen",
			"https://www.etos.nl/acties",
		],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="accept"]',
		],
		priceSelectors: {
			card: '[class*="product"], [class*="Product"], article, li',
			name: '[class*="product-name"], [class*="title"], h2, h3, h4',
			originalPrice: '[class*="was"], [class*="old"], del, s',
			promoPrice: '[class*="price"], [class*="Price"]',
			discount: '[class*="discount"], [class*="badge"], [class*="saving"]',
			image: "img",
		},
		folderLinkPatterns: [
			/^https:\/\/folder\.etos\.nl\//i,
			/^https:\/\/view\.publitas\.com\//i,
		],
	};
}
