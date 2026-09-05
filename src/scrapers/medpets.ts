import { BaseScraper, RetailerConfig, ScrapeContext, DealResult } from "./base";

export class MedpetsScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "medpets",
		name: "Medpets",
		folderTitle: "Medpets promoties",
		folderUrls: [
			"https://www.medpets.be/actie",
			"https://www.medpets.be/outlet",
		],
		dealUrls: ["https://www.medpets.be/actie"],
		cookieSelectors: [
			"#onetrust-accept-btn-handler",
			'button[class*="accept"]',
		],
		// Medpets renders with Tailwind utility classes, so `[class*="price"]`
		// matches nothing. The Vue `ref` attributes survive into the served HTML
		// and are the only stable hooks on the page.
		priceSelectors: {
			card: '[ref="event-accessor"], .box__outer',
			name: '[ref="title"]',
			originalPrice: '[ref="original-price"]',
			promoPrice: '[ref="price"]',
			discount: ".promotion__label",
			image: "picture img, img",
		},
	};

	// Those refs carry the names, but the price is written in by script after
	// hydration, so the served HTML is nameful and priceless. The GTM
	// `dataLayer.push` block on the same page carries both.
	protected async extractJsonLd(ctx: ScrapeContext): Promise<DealResult> {
		return this.mergeEmbeddedDeals(ctx, await super.extractJsonLd(ctx));
	}
}
