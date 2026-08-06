import { BaseScraper, RetailerConfig } from "./base";

export class DouglasScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "douglas",
		name: "Douglas",
		folderTitle: "Douglas promoties",
		// Both previous URLs (/nl/c/promoties/ and /nl/c/sale/) now return Douglas's
		// "DEZE PAGINA BESTAAT HELAAS NIET (MEER)" page. The scraper still captured
		// it happily, so the folder shipped 60 screenshots of a 404 behind a cookie
		// dialog. These are the paths the site's own navigation links today.
		folderUrls: [
			"https://www.douglas.be/nl/c/beauty-sale/05",
			"https://www.douglas.be/nl/c/beauty-sale/outlet/0581",
		],
		dealUrls: [
			"https://www.douglas.be/nl/c/beauty-sale/05",
			"https://www.douglas.be/nl/c/beauty-sale/outlet/0581",
		],
		// Douglas serves Usercentrics, which renders inside a shadow root — no
		// document-level selector can reach it. dismissCookieConsent walks shadow
		// roots and matches the button by text; these remain only as a fast path
		// for any page that still uses OneTrust.
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
