import { BaseScraper, RetailerConfig } from "./base";

export class TreacScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "treac",
		name: "Trekpleister",
		folderTitle: "Trekpleister promoties",
		folderUrls: [
			"https://www.trekpleister.nl/aanbiedingen",
			"https://www.trekpleister.nl/folder",
			"https://www.trekpleister.nl/acties",
		],
		dealUrls: [
			"https://www.trekpleister.nl/aanbiedingen",
			"https://www.trekpleister.nl/acties",
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
		folderLinkPatterns: [
			/^https:\/\/folder\.trekpleister\.nl\//i,
			/^https:\/\/view\.publitas\.com\//i,
		],
	};
}
