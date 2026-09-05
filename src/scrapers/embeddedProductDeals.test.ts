import { describe, expect, it } from "vitest";
import {
	dealsFromEmbeddedJson,
	embeddedJsonBlocks,
	resolvePrice,
} from "./embeddedProductDeals";

const CTX = {
	retailerSlug: "di",
	validFrom: "2026-09-05",
	validUntil: "2026-09-12",
};

// Trimmed from the real di (Proximis) payload: name under `common`, price and
// mergedPrice at the root, discount label only on the merged one.
const DI_PRODUCT = {
	common: {
		id: 42075479,
		title: "Daily Facial Cleanser 236ML",
		URL: { canonical: "https://di.be/nl/cetaphil-daily-42075479" },
		visuals: [{ listItem: "https://img.example/cetaphil.jpeg" }],
	},
	price: {
		currencyCode: "EUR",
		options: { discountDetail: null, priceSource: "webStore" },
		valueWithTax: 10.12,
		valueWithoutTax: 11.15,
		baseValueWithTax: 13.49,
	},
	mergedPrice: {
		options: { discountDetail: "-25%" },
		valueWithTax: 10.12,
		baseValueWithTax: 13.49,
	},
	// Every di product carries this sibling, and its `name`/`title` are the same
	// for all of them.
	typology: { id: 100727, name: "enrichedProduct", title: "Produit Enrichi" },
};

// Trimmed from the real medpets GTM push.
const MEDPETS_ITEM = {
	item_id: "24560",
	item_name: "Orozyme Canine Kauwstrips",
	item_category: "Hond",
	price: 7.4,
};

const asBlock = (obj: unknown) => JSON.stringify(obj);

describe("embeddedJsonBlocks", () => {
	it("pulls the object passed to dataLayer.push", () => {
		const html = `<script>dataLayer.push({"event":"view_item_list","price":1});</script>`;
		expect(embeddedJsonBlocks(html)[0]).toContain('"event":"view_item_list"');
	});

	it("keeps braces that appear inside strings", () => {
		const html = `<script>dataLayer.push({"note":"a } brace","price":1});</script>`;
		const parsed = JSON.parse(embeddedJsonBlocks(html)[0]);
		expect(parsed.note).toBe("a } brace");
	});

	it("walks back from a price key to the object that owns it", () => {
		const html = `<div>{"sku":"x","price":{"valueWithTax":2}}</div>`;
		const parsed = JSON.parse(embeddedJsonBlocks(html)[0]);
		expect(parsed.sku).toBe("x");
	});

	it("returns nothing rather than throwing on a page with no payload", () => {
		expect(embeddedJsonBlocks("<html><body>hello</body></html>")).toEqual([]);
	});
});

describe("resolvePrice", () => {
	it("reads a flat numeric price", () => {
		expect(resolvePrice({ price: 7.4 })?.promoPrice).toBe(7.4);
	});

	it("reads the tax-inclusive value out of a nested price object", () => {
		const r = resolvePrice(DI_PRODUCT as Record<string, unknown>);
		expect(r?.promoPrice).toBe(10.12);
		expect(r?.originalPrice).toBe(13.49);
		expect(r?.discount).toBe("-25%");
	});

	it("ignores a base price that is not actually higher", () => {
		const r = resolvePrice({
			price: { valueWithTax: 9.99, baseValueWithTax: 9.99 },
		});
		expect(r?.originalPrice).toBeUndefined();
	});

	it("rejects a non-price value on the price key", () => {
		// brico's CMS ships strings like this all over the promo page.
		expect(resolvePrice({ price: "halfPriceTitle" })).toBeUndefined();
		expect(resolvePrice({ price: true })).toBeUndefined();
		expect(resolvePrice({ price: 0 })).toBeUndefined();
	});

	it("returns nothing when the price object has no readable amount", () => {
		expect(resolvePrice({ price: { currencyCode: "EUR" } })).toBeUndefined();
	});
});

describe("dealsFromEmbeddedJson", () => {
	it("reads a di product through its nested common container", () => {
		const [deal] = dealsFromEmbeddedJson([asBlock(DI_PRODUCT)], CTX);
		expect(deal.product).toBe("Daily Facial Cleanser 236ML");
		expect(deal.promoPrice).toBe(10.12);
		expect(deal.originalPrice).toBe(13.49);
		expect(deal.discount).toBe("-25%");
		expect(deal.imageUrl).toContain("cetaphil.jpeg");
		expect(deal.affiliateUrl).toContain("42075479");
		expect(deal.validUntil).toBe("2026-09-12");
	});

	it("does not take the name from a sibling that merely has one", () => {
		// `typology` would otherwise name every di product "Produit Enrichi".
		const deals = dealsFromEmbeddedJson([asBlock(DI_PRODUCT)], CTX);
		expect(deals.map((d) => d.product)).not.toContain("Produit Enrichi");
	});

	it("reads a medpets dataLayer item with the price beside the name", () => {
		const [deal] = dealsFromEmbeddedJson([asBlock(MEDPETS_ITEM)], {
			...CTX,
			retailerSlug: "medpets",
		});
		expect(deal.product).toBe("Orozyme Canine Kauwstrips");
		expect(deal.promoPrice).toBe(7.4);
		expect(deal.category).toBe("Hond");
	});

	it("finds products nested inside an ecommerce items array", () => {
		const push = { event: "view_item_list", ecommerce: { items: [MEDPETS_ITEM] } };
		expect(dealsFromEmbeddedJson([asBlock(push)], CTX)).toHaveLength(1);
	});

	it("dedupes a product reached through several blocks", () => {
		const deals = dealsFromEmbeddedJson(
			[asBlock(DI_PRODUCT), asBlock({ results: [DI_PRODUCT] })],
			CTX,
		);
		expect(deals).toHaveLength(1);
	});

	it("keeps two genuinely different products", () => {
		const other = {
			...DI_PRODUCT,
			common: { ...DI_PRODUCT.common, id: 42075480, title: "Lotion 236ML" },
		};
		expect(
			dealsFromEmbeddedJson([asBlock([DI_PRODUCT, other])], CTX),
		).toHaveLength(2);
	});

	it("skips a named node with no price — the brico navigation case", () => {
		const nav = {
			title: "Verf en behang",
			url: "/nl/verf",
			items: [{ title: "Muurverf", url: "/nl/verf/muurverf" }],
		};
		expect(dealsFromEmbeddedJson([asBlock(nav)], CTX)).toEqual([]);
	});

	it("skips a priced node with no name anywhere it may look", () => {
		expect(dealsFromEmbeddedJson([asBlock({ price: 4.99 })], CTX)).toEqual([]);
	});

	it("accepts a comma decimal, which some payloads still emit", () => {
		const [deal] = dealsFromEmbeddedJson(
			[asBlock({ name: "Kauwstrips", id: "9", price: "7,40" })],
			CTX,
		);
		expect(deal.promoPrice).toBe(7.4);
	});

	it("survives one malformed block without discarding the rest", () => {
		const deals = dealsFromEmbeddedJson(["{not json", asBlock(DI_PRODUCT)], CTX);
		expect(deals).toHaveLength(1);
	});
});
