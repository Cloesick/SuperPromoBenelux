import { BaseScraper, RetailerConfig } from "./base";

export class RitualsScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "rituals",
		name: "Rituals",
		folderTitle: "Rituals promoties",
		folderUrls: [
			"https://www.rituals.com/nl-be/sale",
			"https://www.rituals.com/nl-be/promotions",
			"https://www.rituals.com/nl-be/aanbiedingen",
		],
		dealUrls: [
			"https://www.rituals.com/nl-be/sale",
			"https://www.rituals.com/nl-be/promotions",
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
