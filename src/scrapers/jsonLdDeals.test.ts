import { describe, it, expect } from "vitest";
import { dealsFromJsonLd, jsonLdBlocks } from "./jsonLdDeals";

const ctx = {
	retailerSlug: "coolblue",
	validFrom: "2026-08-24",
	validUntil: "2026-08-31",
};

describe("dealsFromJsonLd", () => {
	it("reads products nested inside @graph", () => {
		// The shape the previous top-level-only extractor could not see.
		const block = JSON.stringify({
			"@context": "https://schema.org",
			"@graph": [
				{ "@type": "WebPage", name: "Aanbiedingen" },
				{ "@type": "Product", name: "Wasmachine X", offers: { price: "499.00" } },
			],
		});
		const deals = dealsFromJsonLd([block], ctx);
		expect(deals).toHaveLength(1);
		expect(deals[0].product).toBe("Wasmachine X");
		expect(deals[0].promoPrice).toBe(499);
	});

	it("accepts @type given as an array", () => {
		const block = JSON.stringify({
			"@type": ["Product", "IndividualProduct"],
			name: "Koffiezet",
			offers: { price: 79.99, highPrice: 99.99 },
		});
		const [deal] = dealsFromJsonLd([block], ctx);
		expect(deal.product).toBe("Koffiezet");
		expect(deal.promoPrice).toBe(79.99);
		expect(deal.originalPrice).toBe(99.99);
	});

	it("walks ItemList entries", () => {
		const block = JSON.stringify({
			"@type": "ItemList",
			itemListElement: [
				{ item: { "@type": "Product", name: "A", offers: { price: "1.50" } } },
				{ item: { "@type": "Product", name: "B", offers: { price: "2.50" } } },
			],
		});
		expect(dealsFromJsonLd([block], ctx).map((d) => d.product)).toEqual(["A", "B"]);
	});

	it("parses comma decimals", () => {
		const block = JSON.stringify({
			"@type": "Product",
			name: "Frisdrank",
			offers: { price: "1,99" },
		});
		expect(dealsFromJsonLd([block], ctx)[0].promoPrice).toBe(1.99);
	});

	it("emits one row per distinct offer but dedupes repeats", () => {
		const block = JSON.stringify({
			"@type": "Product",
			name: "Shampoo",
			offers: [{ price: "3.00" }, { price: "5.00" }, { price: "3.00" }],
		});
		expect(dealsFromJsonLd([block], ctx).map((d) => d.promoPrice)).toEqual([3, 5]);
	});

	it("keeps the rest of the page when one block is malformed", () => {
		const good = JSON.stringify({
			"@type": "Product",
			name: "Goed",
			offers: { price: "9.99" },
		});
		const deals = dealsFromJsonLd(["{ not json", good], ctx);
		expect(deals.map((d) => d.product)).toEqual(["Goed"]);
	});

	it("ignores entries with no usable name", () => {
		const block = JSON.stringify({ "@type": "Product", offers: { price: "5.00" } });
		expect(dealsFromJsonLd([block], ctx)).toHaveLength(0);
	});

	it("drops non-positive and unparseable prices", () => {
		const block = JSON.stringify({
			"@type": "Product",
			name: "Gratis staal",
			offers: { price: "0" },
		});
		expect(dealsFromJsonLd([block], ctx)[0].promoPrice).toBeUndefined();
	});

	it("stamps validity and retailer onto every row", () => {
		const block = JSON.stringify({
			"@type": "Product",
			name: "X",
			offers: { price: "1.00" },
		});
		const [deal] = dealsFromJsonLd([block], ctx);
		expect(deal.retailerSlug).toBe("coolblue");
		expect(deal.validFrom).toBe("2026-08-24");
		expect(deal.validUntil).toBe("2026-08-31");
	});
});

describe("jsonLdBlocks", () => {
	it("pulls every ld+json body out of a page", () => {
		const html = `
			<script type="application/ld+json">{"a":1}</script>
			<script type="text/javascript">ignored()</script>
			<script type='application/ld+json'>{"b":2}</script>`;
		expect(jsonLdBlocks(html)).toHaveLength(2);
	});
});
