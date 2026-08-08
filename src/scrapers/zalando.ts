import { BaseScraper, RetailerConfig } from "./base";

export class ZalandoScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "zalando",
		name: "Zalando",
		folderTitle: "Zalando outlet",
		folderUrls: [
			"https://www.zalando.be/promo/",
			"https://www.zalando.be/promo-dames/",
			"https://www.zalando.be/promo-heren/",
		],
		dealUrls: [
			"https://www.zalando.be/promo/",
			"https://www.zalando.be/promo-dames/",
		],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="accept"]',
		],
		priceSelectors: {
			card: "article, [data-testid*='product'], [class*='product']",
			name: "h2, h3, [data-testid*='product-name'], [class*='product']",
			originalPrice: "del, s, [class*='old'], [class*='previous']",
			promoPrice: "[data-testid*='price'], [class*='price']",
			discount: "[class*='discount'], [class*='badge'], [class*='label']",
			image: "img",
		},
	};
}
