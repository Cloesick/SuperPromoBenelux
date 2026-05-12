import { BaseScraper, RetailerConfig } from "./base";

export class IciParisXlScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "ici-paris-xl",
		name: "ICI PARIS XL",
		folderTitle: "ICI PARIS XL promoties",
		folderUrls: ["https://www.iciparisxl.be/nl/promotions", "https://www.iciparisxl.be/nl/acties-promoties"],
		dealUrls: ["https://www.iciparisxl.be/nl/promotions"],
		cookieSelectors: ["#onetrust-accept-btn-handler"],
		priceSelectors: {
			card: "[data-testid*='product'], [class*='product'], [class*='Product'], article, li",
			name: "[data-testid*='product-title'], [class*='title'], [class*='Title'], h2, h3, h4",
			originalPrice: "[class*='was'], [class*='old'], [class*='strike'], del, s",
			promoPrice: "[data-testid*='price'], [class*='price'], [class*='Price']",
			discount: "[class*='discount'], [class*='badge'], [class*='label']",
			image: "img",
		},
	};
}
