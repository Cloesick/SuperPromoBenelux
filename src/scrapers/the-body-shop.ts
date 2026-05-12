import { BaseScraper, RetailerConfig } from "./base";

export class TheBodyShopScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "the-body-shop",
		name: "The Body Shop",
		folderTitle: "The Body Shop promoties",
		folderUrls: [
			"https://www.thebodyshop.com/en-gb/sale/c/c00005",
			"https://www.thebodyshop.com/nl-nl/sale/c/c00005",
			"https://www.thebodyshop.com/nl-be/sale/c/c00005",
		],
		dealUrls: [
			"https://www.thebodyshop.com/en-gb/sale/c/c00005",
			"https://www.thebodyshop.com/nl-nl/sale/c/c00005",
		],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="accept"]',
		],
		priceSelectors: {
			card: '[class*="product"], [class*="Product"], article, li',
			name: '[class*="product-name"], [class*="title"], h2, h3, h4',
			originalPrice: '[class*="was"], [class*="old"], del, s',
			promoPrice: '[class*="price"], [class*="Price"]',
			discount: '[class*="discount"], [class*="badge"], [class*="saving"]',
			image: "img",
		},
	};
}
