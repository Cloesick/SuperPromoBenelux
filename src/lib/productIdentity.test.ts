import { describe, expect, it } from "vitest";
import { canonicalKey, normalizeBrand, parseSize } from "./productIdentity";

// ---------------------------------------------------------------------------
// Belgian leaflets write sizes in Dutch/French conventions: comma decimals,
// multipacks as "6 x 33 cl", and units that mix metric scales. Everything must
// reduce to one base unit per dimension or cross-retailer matching is guesswork.
// ---------------------------------------------------------------------------

describe("parseSize", () => {
	it("converts litres to millilitres with a comma decimal", () => {
		expect(parseSize("1,5 L")).toEqual({
			value: 1500,
			unit: "ml",
			multipack: 1,
		});
	});

	it("accepts a dot decimal and no space", () => {
		expect(parseSize("1.5l")).toEqual({ value: 1500, unit: "ml", multipack: 1 });
	});

	it("converts centilitres", () => {
		expect(parseSize("33 cl")).toEqual({ value: 330, unit: "ml", multipack: 1 });
	});

	it("converts kilograms to grams", () => {
		expect(parseSize("1 kg")).toEqual({ value: 1000, unit: "g", multipack: 1 });
	});

	it("keeps grams as grams", () => {
		expect(parseSize("500g")).toEqual({ value: 500, unit: "g", multipack: 1 });
	});

	it("expands a multipack to its total volume and records the count", () => {
		// 6 x 33 cl is 1980 ml total. Storing both lets us compare a six-pack
		// against a six-pack rather than against a single bottle.
		expect(parseSize("6 x 33 cl")).toEqual({
			value: 1980,
			unit: "ml",
			multipack: 6,
		});
	});

	it("handles a multipack written without spaces", () => {
		expect(parseSize("4x125g")).toEqual({
			value: 500,
			unit: "g",
			multipack: 4,
		});
	});

	it("treats a bare count as pieces", () => {
		expect(parseSize("10 stuks")).toEqual({
			value: 10,
			unit: "piece",
			multipack: 1,
		});
	});

	it("returns null when there is no size to parse", () => {
		expect(parseSize("")).toBeNull();
		expect(parseSize("per stuk")).toBeNull();
	});
});

describe("normalizeBrand", () => {
	it("lowercases and strips punctuation and spacing", () => {
		expect(normalizeBrand("Coca-Cola")).toBe("cocacola");
		expect(normalizeBrand("Coca Cola")).toBe("cocacola");
		expect(normalizeBrand("COCA-COLA®")).toBe("cocacola");
	});

	it("strips accents so Dutch and French spellings converge", () => {
		expect(normalizeBrand("Café Liégeois")).toBe("cafeliegeois");
	});
});

describe("canonicalKey", () => {
	it("joins normalized brand with the reduced size", () => {
		expect(canonicalKey("Coca-Cola", parseSize("1,5 L"))).toBe(
			"cocacola|1500ml|1",
		);
	});

	it("distinguishes a multipack from the same total volume sold singly", () => {
		// 6x33cl and a single 1980ml bottle are not the same product to a shopper.
		expect(canonicalKey("Jupiler", parseSize("6 x 33 cl"))).not.toBe(
			canonicalKey("Jupiler", parseSize("1980 ml")),
		);
	});

	it("marks an unknown size rather than colliding every sizeless product", () => {
		expect(canonicalKey("Boni", null)).toBe("boni|nosize|1");
	});
});
