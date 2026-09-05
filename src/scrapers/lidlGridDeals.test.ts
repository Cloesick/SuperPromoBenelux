import { describe, expect, it } from "vitest";
import { dealsFromLidlGrid, lidlGridBlocks } from "./lidlGridDeals";

const CTX = {
	retailerSlug: "lidl",
	validFrom: "2026-08-31",
	validUntil: "2026-09-05",
};

// Trimmed from the real 2026-w36 page: the shape that matters is the price
// hanging off lidlPlus[].price rather than the product's own `price`, which
// carries only currency metadata.
const WITLOOF = {
	fullTitle: "Witloof",
	itemId: 10029889,
	havingPrice: true,
	analyticsCategory: "Groenten en fruit",
	image: "https://img.example/witloof.png",
	canonicalUrl: "https://www.lidl.be/p/witloof/p10029889",
	price: { currencyCode: "EUR", hasVat: false },
	keyfacts: {
		supplementalDescription: "voorverpakt - € 3,70 - € 1,85 voor. 2 packs",
	},
	lidlPlus: [
		{
			price: {
				price: 1.85,
				oldPrice: 3.7,
				discount: { deletedPrice: 3.7, discountText: "1 + 1 GRATIS" },
				basePrice: { text: "2 x 500 g - 1,85 EUR/kg" },
			},
		},
	],
};

const asBlock = (obj: unknown) => JSON.stringify(obj);

describe("lidlGridBlocks", () => {
	it("pulls and unescapes data-grid-data attributes", () => {
		const html = `<div data-grid-data="{&quot;a&quot;:1}"></div>
		               <div data-grid-data="{&quot;b&quot;:2}"/>`;
		expect(lidlGridBlocks(html)).toEqual(['{"a":1}', '{"b":2}']);
	});

	it("unescapes &amp; last, so &amp;quot; does not become a real quote", () => {
		const html = `<div data-grid-data="{&quot;t&quot;:&quot;Ben &amp;amp; Jerry&quot;}"></div>`;
		const [block] = lidlGridBlocks(html);
		expect(JSON.parse(block).t).toBe("Ben &amp; Jerry");
	});

	it("returns nothing rather than throwing on a page without the attribute", () => {
		expect(lidlGridBlocks("<html><body>no grid here</body></html>")).toEqual([]);
	});
});

describe("dealsFromLidlGrid", () => {
	it("reads name, both prices, mechanic, category and links", () => {
		const [deal] = dealsFromLidlGrid([asBlock(WITLOOF)], CTX);
		expect(deal.product).toBe("Witloof");
		expect(deal.promoPrice).toBe(1.85);
		expect(deal.originalPrice).toBe(3.7);
		expect(deal.discount).toBe("1 + 1 GRATIS");
		expect(deal.category).toBe("Groenten en fruit");
		expect(deal.description).toContain("2 packs");
		expect(deal.affiliateUrl).toContain("p10029889");
		expect(deal.retailerSlug).toBe("lidl");
		expect(deal.validUntil).toBe("2026-09-05");
	});

	it("falls back to discount.deletedPrice when oldPrice is absent", () => {
		const p = structuredClone(WITLOOF) as Record<string, any>;
		delete p.lidlPlus[0].price.oldPrice;
		const [deal] = dealsFromLidlGrid([asBlock(p)], CTX);
		expect(deal.originalPrice).toBe(3.7);
	});

	it("finds products nested inside carousels rather than only at the root", () => {
		const nested = { widgets: [{ items: { products: [WITLOOF] } }] };
		expect(dealsFromLidlGrid([asBlock(nested)], CTX)).toHaveLength(1);
	});

	it("dedupes the same itemId reached through several blocks", () => {
		const deals = dealsFromLidlGrid(
			[asBlock(WITLOOF), asBlock({ nested: WITLOOF })],
			CTX,
		);
		expect(deals).toHaveLength(1);
	});

	it("keeps two genuinely different products", () => {
		const other = { ...WITLOOF, fullTitle: "Vijgen", itemId: 10029901 };
		expect(dealsFromLidlGrid([asBlock([WITLOOF, other])], CTX)).toHaveLength(2);
	});

	it("skips catalogue filler flagged havingPrice:false", () => {
		const filler = { ...WITLOOF, havingPrice: false };
		expect(dealsFromLidlGrid([asBlock(filler)], CTX)).toHaveLength(0);
	});

	it("skips a product with no price anywhere beneath it", () => {
		const p = structuredClone(WITLOOF) as Record<string, any>;
		delete p.lidlPlus;
		expect(dealsFromLidlGrid([asBlock(p)], CTX)).toHaveLength(0);
	});

	it("accepts a comma decimal, which some page types still emit", () => {
		const p = structuredClone(WITLOOF) as Record<string, any>;
		p.lidlPlus[0].price.price = "1,85";
		expect(dealsFromLidlGrid([asBlock(p)], CTX)[0].promoPrice).toBe(1.85);
	});

	it("survives one malformed block without discarding the rest", () => {
		const deals = dealsFromLidlGrid(["{not json", asBlock(WITLOOF)], CTX);
		expect(deals).toHaveLength(1);
	});
});
