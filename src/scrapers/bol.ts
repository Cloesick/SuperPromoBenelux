import { BaseScraper, RetailerConfig } from "./base";

export class BolScraper extends BaseScraper {
	config: RetailerConfig = {
		slug: "bol",
		name: "bol",
		folderTitle: "bol promoties",
		// bol is a webshop, not a leaflet retailer — there is no folder/flipbook
		// to embed, so these are deal listings and the folder is rendered from
		// screenshots. `/be/nl/m/aanbiedingen/` was a 404 ("Pagina niet
		// gevonden!") that still rendered full site chrome, so nothing upstream
		// flagged it; the daily-deal campaign page below is live.
		folderUrls: [
			"https://www.bol.com/be/nl/deals/",
			"https://www.bol.com/be/nl/cmp/dagdeal/610/",
		],
		dealUrls: ["https://www.bol.com/be/nl/deals/"],
		// bol serves two different consent modals and neither uses shadow DOM or
		// an iframe. The current React pages render a Radix dialog whose buttons
		// carry no id or test hook at all — only generated utility classes — so
		// it is the shared CONSENT_TEXTS match on the literal label "Weigeren"
		// that dismisses it, not a selector. The legacy `wsp-consent-modal-ofc`
		// still appears on older routes and does expose stable hooks, so those
		// are configured here. `button[class*="accept"]` was dropped: it matches
		// nothing on either modal and would happily click an unrelated button.
		// The last entry is not a consent button at all: once the cookie modal is
		// answered, bol raises a second blocking dialog — the country/language
		// picker ("Hoe wil jij bollen?") — on every navigation. It is what kept
		// logging "Cookie dialog still present after consent handling" and it
		// covered the top of every screenshot. Its "Doorgaan" button carries no
		// id or test hook, so it is reached by scoping to the one dialog that
		// contains the language radios (#lang1 / #reg1, which are stable) and
		// taking the single primary button inside it. Scoping matters: the same
		// `button.h-12` class is on the cookie modal's "Alles accepteren", and an
		// unscoped selector would opt the scraper into tracking.
		cookieSelectors: [
			"#js-reject-all-button",
			'[data-testid="consent-modal-ofc-reject-btn"]',
			"#js-first-screen-accept-all-button",
			"#onetrust-accept-btn-handler",
			'[role="dialog"]:has(#lang1) button.h-12',
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
