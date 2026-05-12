import { BaseScraper, RetailerConfig } from "./base";

export class MaxiZooScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "maxi-zoo",
		name: "Maxi Zoo",
		folderTitle: "Maxi Zoo promoties",
		folderUrls: [
			"https://www.maxizoo.be/nl/promoties",
			"https://www.maxizoo.be/nl/aanbiedingen",
		],
		dealUrls: ["https://www.maxizoo.be/nl/promoties"],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="accept"]',
		],
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
