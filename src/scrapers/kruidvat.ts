import { BaseScraper, RetailerConfig } from "./base";

export class KruidvatScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "kruidvat",
		name: "Kruidvat",
		folderTitle: "Kruidvat folder",
		folderUrls: ["https://www.kruidvat.be/nl/folder", "https://folder.kruidvat.be/"],
		dealUrls: ["https://www.kruidvat.be/nl/promo"],
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
			/^https:\/\/folder\.kruidvat\.be\//i,
			/^https:\/\/view\.publitas\.com\//i,
		],
	};
}
