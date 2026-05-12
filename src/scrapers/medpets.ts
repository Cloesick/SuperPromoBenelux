import { BaseScraper, RetailerConfig } from "./base";

export class MedpetsScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "medpets",
		name: "Medpets",
		folderTitle: "Medpets promoties",
		folderUrls: [
			"https://www.medpets.be/acties",
			"https://www.medpets.be/aanbiedingen",
		],
		dealUrls: ["https://www.medpets.be/acties"],
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
