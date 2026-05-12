import { BaseScraper, RetailerConfig } from "./base";

export class IkeaScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "ikea",
		name: "IKEA",
		folderTitle: "IKEA aanbiedingen",
		folderUrls: [
			"https://www.ikea.com/be/nl/offers/",
			"https://www.ikea.com/nl/nl/offers/",
			"https://www.ikea.com/be/nl/cat/aanbiedingen-702/",
		],
		dealUrls: [
			"https://www.ikea.com/be/nl/offers/",
			"https://www.ikea.com/be/nl/cat/aanbiedingen-702/",
		],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="accept"]',
		],
		priceSelectors: {
			card: "[data-testid*='product'], [class*='product'], [class*='Product'], article, li",
			name: "[data-testid*='product-name'], [class*='product'], h2, h3, h4",
			originalPrice: "[class*='old'], [class*='was'], del, s",
			promoPrice: "[data-testid*='price'], [class*='price'], [class*='Price']",
			discount: "[class*='discount'], [class*='badge'], [class*='label']",
			image: "img",
		},
	};
}
