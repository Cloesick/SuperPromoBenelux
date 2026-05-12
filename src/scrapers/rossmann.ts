import { BaseScraper, RetailerConfig } from "./base";

export class RossmannScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "rossmann",
		name: "Rossmann",
		folderTitle: "Rossmann promoties",
		folderUrls: [
			"https://www.rossmann.nl/nl/acties/",
			"https://www.rossmann.nl/nl/aanbiedingen/",
			"https://www.rossmann.de/de/angebote",
		],
		dealUrls: [
			"https://www.rossmann.nl/nl/acties/",
			"https://www.rossmann.nl/nl/aanbiedingen/",
		],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="accept"]',
			'button[class*="consent"]',
		],
		priceSelectors: {
			card: '[class*="product"], [class*="Product"], article, li',
			name: '[class*="product-name"], [class*="title"], h2, h3, h4',
			originalPrice:
				'[class*="was"], [class*="old"], [class*="strike"], del, s',
			promoPrice: '[class*="price"], [class*="Price"]',
			discount: '[class*="discount"], [class*="badge"], [class*="saving"]',
			image: "img",
		},
	};
}
