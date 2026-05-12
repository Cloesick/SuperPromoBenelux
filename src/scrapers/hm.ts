import { BaseScraper, RetailerConfig } from "./base";

export class HmScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "hm",
		name: "H&M",
		folderTitle: "H&M sale",
		folderUrls: [
			"https://www2.hm.com/nl_be/sale/dames/view-all.html",
			"https://www2.hm.com/nl_be/sale/heren/view-all.html",
			"https://www2.hm.com/nl_be/sale.html",
		],
		dealUrls: [
			"https://www2.hm.com/nl_be/sale/dames/view-all.html",
			"https://www2.hm.com/nl_be/sale/heren/view-all.html",
		],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="accept"]',
		],
		priceSelectors: {
			card: "[class*='product-item'], [class*='productItem'], li",
			name: "[class*='product-item-heading'], [class*='productItemHeading'], h2, h3, h4",
			originalPrice: "[class*='old'], [class*='previous'], del, s",
			promoPrice: "[class*='price'], [class*='Price']",
			discount: "[class*='discount'], [class*='badge']",
			image: "img",
		},
	};
}
