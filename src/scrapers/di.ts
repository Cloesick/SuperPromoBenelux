import { BaseScraper, RetailerConfig, ScrapeContext, DealResult } from "./base";

export class DiScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "di",
		name: "Di",
		folderTitle: "Di promoties",
		folderUrls: [
			"https://www.di.be/promotions.html",
			"https://www.di.be/promotions/",
		],
		dealUrls: ["https://www.di.be/promotions.html"],
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

	// Di runs Proximis, which serves the grid as inline product JSON and paints
	// it client-side; the wildcard selectors above match the shell, not prices.
	// The payload has the was-price and the discount label the shell never shows.
	protected async extractJsonLd(ctx: ScrapeContext): Promise<DealResult> {
		return this.mergeEmbeddedDeals(ctx, await super.extractJsonLd(ctx));
	}
}
