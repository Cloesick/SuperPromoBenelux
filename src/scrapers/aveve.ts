import { BaseScraper, RetailerConfig } from "./base";

export class AveveScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "aveve",
		name: "AVEVE",
		folderTitle: "AVEVE promoties",
		folderUrls: [
			"https://www.aveve.be/nl/promoties",
			"https://www.aveve.be/nl/huisdier",
		],
		dealUrls: ["https://www.aveve.be/nl/promoties"],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="accept"]',
		],
		priceSelectors: {
			card: '[class*="product"], [class*="tile"], [class*="card"], article, li',
			name: '[class*="product-name"], [class*="title"], h2, h3, h4',
			originalPrice: '[class*="old-price"], [class*="was-price"], del, s',
			promoPrice: '[class*="price"], [class*="new-price"]',
			discount: '[class*="discount"], [class*="badge"], [class*="saving"]',
			image: "img",
		},
	};
}
