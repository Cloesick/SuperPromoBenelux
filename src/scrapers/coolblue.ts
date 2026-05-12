import { BaseScraper, RetailerConfig } from "./base";

export class CoolblueScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "coolblue",
		name: "Coolblue",
		folderTitle: "Coolblue promoties",
		folderUrls: [
			"https://www.coolblue.be/nl/aanbieding",
			"https://www.coolblue.be/nl/promotie",
		],
		dealUrls: ["https://www.coolblue.be/nl/aanbieding"],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="accept"]',
		],
		priceSelectors: {
			card: "[data-testid*='product-card'], [class*='product-card'], article",
			name: "[data-testid*='product-title'], [class*='product-title'], h2, h3, h4",
			originalPrice: "[class*='was'], [class*='old'], del, s",
			promoPrice: "[data-testid*='price'], [class*='price']",
			discount: "[class*='discount'], [class*='badge']",
			image: "img",
		},
	};
}
