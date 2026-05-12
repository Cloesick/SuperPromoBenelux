import { BaseScraper, RetailerConfig } from "./base";

export class BootsScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "boots",
		name: "Boots",
		folderTitle: "Boots promoties",
		folderUrls: [
			"https://www.boots.com/offers",
			"https://www.boots.com/health-pharmacy-advice/offers",
			"https://www.boots.com/beauty/beauty-offers",
		],
		dealUrls: [
			"https://www.boots.com/offers",
			"https://www.boots.com/beauty/beauty-offers",
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
	};
}
