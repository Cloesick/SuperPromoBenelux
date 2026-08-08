import { BaseScraper, RetailerConfig } from "./base";

export class KrefelScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "krefel",
		name: "Krëfel",
		folderTitle: "Krëfel promoties",
		folderUrls: [
			"https://www.krefel.be/nl/promoties",
			"https://www.krefel.be/nl/acties",
		],
		dealUrls: ["https://www.krefel.be/nl/promoties"],
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
