import { BaseScraper, RetailerConfig } from "./base";

export class ActionScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "action",
		name: "Action",
		folderTitle: "Action folder van de week",
		folderUrls: [
			"https://www.action.com/nl-be/folder/",
			"https://www.action.com/nl-be/weekactie/",
			"https://be.publications.action.com/",
		],
		dealUrls: ["https://www.action.com/nl-be/weekactie/"],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			"button#onetrust-accept-btn-handler",
		],
		folderLinkPatterns: [
			/be\.publications\.action\.com/,
			/publications\.action\.com/,
		],
		priceSelectors: {
			card: '[class*="product"], [class*="tile"], [class*="card"], article',
			name: '[class*="product-name"], [class*="title"], h3, h4',
			originalPrice: '[class*="old-price"], [class*="was-price"], del, s',
			promoPrice: '[class*="price"], [class*="new-price"]',
			discount: '[class*="discount"], [class*="badge"], [class*="saving"]',
			image: 'img[src*="product"], img[class*="product"], picture img',
		},
	};
}
