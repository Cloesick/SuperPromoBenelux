import { BaseScraper, RetailerConfig } from "./base";

export class TomCoScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "tom-co",
		name: "Tom&Co",
		folderTitle: "Tom&Co promoties",
		folderUrls: [
			"https://www.tomandco.com/nl-be/promoties",
			"https://www.tomandco.com/nl-be/aanbiedingen",
		],
		dealUrls: ["https://www.tomandco.com/nl-be/promoties"],
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
