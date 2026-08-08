import { BaseScraper, RetailerConfig } from "./base";

export class ZooplusScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "zooplus",
		name: "Zooplus",
		folderTitle: "Zooplus promoties",
		folderUrls: [
			"https://www.zooplus.be/shop/acties",
			"https://www.zooplus.be/shop/aanbiedingen",
		],
		dealUrls: ["https://www.zooplus.be/shop/acties"],
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
