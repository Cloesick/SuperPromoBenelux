import { BaseScraper, RetailerConfig } from "./base";

export class GammaScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "gamma",
		name: "Gamma",
		folderTitle: "Gamma folder",
		folderUrls: [
			"https://www.gamma.be/nl/promo/acties/folder/folder-deze-week",
			"https://www.gamma.be/nl/promo/acties/folder",
			"https://folder.gamma.be/",
		],
		dealUrls: ["https://www.gamma.be/nl/promo/acties"],
		cookieSelectors: ["#onetrust-accept-btn-handler"],
		priceSelectors: {
			card: "[data-testid*='product'], [class*='product'], [class*='Product'], article, li",
			name: "[data-testid*='product-title'], [class*='title'], [class*='Title'], h2, h3, h4",
			originalPrice: "[class*='was'], [class*='old'], [class*='strike'], del, s",
			promoPrice: "[data-testid*='price'], [class*='price'], [class*='Price']",
			discount: "[class*='discount'], [class*='badge'], [class*='label']",
			image: "img",
		},
		folderLinkPatterns: [
			/^https:\/\/folder\.gamma\.be\//i,
			/^https:\/\/view\.publitas\.com\//i,
		],
	};
}
