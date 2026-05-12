import { BaseScraper, RetailerConfig } from "./base";

export class MediaMarktScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "mediamarkt",
		name: "MediaMarkt",
		folderTitle: "MediaMarkt folder",
		folderUrls: [
			"https://www.mediamarkt.be/nl/shop/folder.html",
			"https://www.mediamarkt.be/nl/shop/Sales14-Folder.html",
			"https://www.mediamarkt.be/nl/campaign/folder",
		],
		dealUrls: [
			"https://www.mediamarkt.be/nl/shop/folder.html",
			"https://www.mediamarkt.be/nl/campaign/folder",
		],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			"button#onetrust-accept-btn-handler",
			"button[aria-label*='Accept']",
		],
		folderLinkPatterns: [
			/mediamarkt\.be\/nl\/campaign\/folder/,
			/view\.publitas\.com/,
		],
		priceSelectors: {
			card: "[data-test*='product'], [class*='product'], [class*='Product'], article",
			name: "[data-test*='product-title'], [class*='title'], [class*='Title'], h2, h3, h4",
			originalPrice:
				"[class*='was'], [class*='old'], [class*='strike'], del, s",
			promoPrice: "[class*='price'], [data-test*='price'], [class*='Price']",
			discount: "[class*='discount'], [class*='badge'], [class*='label']",
			image: "img",
		},
	};
}
