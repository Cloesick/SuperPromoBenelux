import { BaseScraper, RetailerConfig } from "./base";

export class MullerScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "muller",
		name: "Müller",
		folderTitle: "Müller promoties",
		folderUrls: [
			"https://www.mueller.de/angebote/",
			"https://www.mueller.de/parfuemerie/angebote/",
			"https://www.mueller.de/drogerieprodukte/angebote/",
		],
		dealUrls: [
			"https://www.mueller.de/angebote/",
			"https://www.mueller.de/parfuemerie/angebote/",
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
