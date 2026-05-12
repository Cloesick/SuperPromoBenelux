import { BaseScraper, RetailerConfig } from "./base";

export class YvesRocherScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "yves-rocher",
		name: "Yves Rocher",
		folderTitle: "Yves Rocher promoties",
		folderUrls: [
			"https://www.yves-rocher.be/nl/promoties",
			"https://www.yves-rocher.be/nl/aanbiedingen",
		],
		dealUrls: [
			"https://www.yves-rocher.be/nl/promoties",
			"https://www.yves-rocher.be/nl/aanbiedingen",
		],
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
