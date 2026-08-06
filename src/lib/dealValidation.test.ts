import { describe, expect, it } from "vitest";
import {
	parseEuroPrice,
	isPlausiblePrice,
	salvagePricesFromLabel,
	salvageDeal,
	validateDeal,
	sanitizeDeals,
} from "./dealValidation";
import { Deal } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deal(partial: Partial<Deal>): Deal {
	return {
		id: "test-1",
		product: "Testproduct 500 gram",
		validFrom: "2026-08-03",
		validUntil: "2026-08-09",
		retailerSlug: "testretailer",
		...partial,
	};
}

// ---------------------------------------------------------------------------
// European price parsing
// ---------------------------------------------------------------------------

describe("parseEuroPrice", () => {
	it("parses comma as decimal separator", () => {
		expect(parseEuroPrice("49,99")).toBe(49.99);
	});

	it("parses dot as decimal separator", () => {
		expect(parseEuroPrice("49.99")).toBe(49.99);
	});

	it("parses European thousands format", () => {
		expect(parseEuroPrice("1.499,00")).toBe(1499);
	});

	it("parses anglo thousands format", () => {
		expect(parseEuroPrice("1,499.00")).toBe(1499);
	});

	it("treats a bare 3-digit comma group as thousands", () => {
		expect(parseEuroPrice("1,499")).toBe(1499);
	});

	it("strips euro signs and whitespace", () => {
		expect(parseEuroPrice(" € 2,50 ")).toBe(2.5);
	});

	it("returns undefined for non-numeric input", () => {
		expect(parseEuroPrice("Bonus")).toBeUndefined();
		expect(parseEuroPrice("")).toBeUndefined();
		expect(parseEuroPrice(null)).toBeUndefined();
	});
});

describe("isPlausiblePrice", () => {
	it("accepts normal retail prices", () => {
		expect(isPlausiblePrice(0.99)).toBe(true);
		expect(isPlausiblePrice(1499)).toBe(true);
	});

	it("rejects zero, negatives and absurd values", () => {
		expect(isPlausiblePrice(0)).toBe(false);
		expect(isPlausiblePrice(-1)).toBe(false);
		expect(isPlausiblePrice(999_999)).toBe(false);
		expect(isPlausiblePrice(undefined)).toBe(false);
		expect(isPlausiblePrice(NaN)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Salvage — real labels observed in promo_products
// ---------------------------------------------------------------------------

describe("salvagePricesFromLabel", () => {
	it("recovers a single price from the Albert Heijn 'voor0.99' form", () => {
		expect(salvagePricesFromLabel("voor0.99")).toEqual({ promoPrice: 0.99 });
	});

	it("recovers a spaced, comma-decimal variant", () => {
		expect(salvagePricesFromLabel("voor 1,99")).toEqual({ promoPrice: 1.99 });
	});

	it("recovers a multi-buy bundle price with its quantity", () => {
		expect(salvagePricesFromLabel("3 voor5.00")).toEqual({
			promoPrice: 5,
			quantity: 3,
		});
	});

	it("recovers both prices from a van/voor pair", () => {
		expect(salvagePricesFromLabel("van 2,99 voor 1,99")).toEqual({
			promoPrice: 1.99,
			originalPrice: 2.99,
		});
	});

	it("handles the French pour form", () => {
		expect(salvagePricesFromLabel("pour 2,50")).toEqual({ promoPrice: 2.5 });
	});

	it("yields nothing for a reduction, where the absolute price is unknown", () => {
		expect(salvagePricesFromLabel("€1korting")).toEqual({});
		expect(salvagePricesFromLabel("-30%")).toEqual({});
		expect(salvagePricesFromLabel("1+1 gratis")).toEqual({});
	});

	it("yields nothing for a bare promo brand name", () => {
		expect(salvagePricesFromLabel("Bonus")).toEqual({});
	});

	it("ignores a van/voor pair whose original is below the promo", () => {
		expect(salvagePricesFromLabel("van 1,00 voor 2,00")).toEqual({
			promoPrice: 2,
		});
	});
});

describe("salvageDeal", () => {
	it("fills in a missing promo price from the label", () => {
		const result = salvageDeal(
			deal({ product: "AH Cherrytomaten 250 gram", discount: "voor0.99" }),
		);
		expect(result.promoPrice).toBe(0.99);
	});

	it("never overwrites a price the extractor already found", () => {
		const result = salvageDeal(deal({ promoPrice: 2.49, discount: "voor0.99" }));
		expect(result.promoPrice).toBe(2.49);
	});

	it("leaves the deal untouched when nothing is recoverable", () => {
		const input = deal({ discount: "Bonus" });
		expect(salvageDeal(input)).toEqual(input);
	});
});

// ---------------------------------------------------------------------------
// Validation — every rejection case below is a real row from products.db
// ---------------------------------------------------------------------------

describe("validateDeal", () => {
	it("rejects inline CSS scraped from an SVG (colruyt, €0.12)", () => {
		const r = validateDeal(deal({ product: ".st0{fill:#A6A6A6;}", promoPrice: 0.12 }));
		expect(r.ok).toBe(false);
		expect(r.reason).toBe("name_is_css");
	});

	it("rejects German regulatory boilerplate (rossmann, €15.05)", () => {
		const r = validateDeal(
			deal({
				product: "AUSGESTELLT II.1 Verzeichnis der Erzeugnisse Name des",
				promoPrice: 15.05,
			}),
		);
		expect(r.ok).toBe(false);
		expect(r.reason).toBe("name_is_legal_boilerplate");
	});

	it("rejects empty-state UI text (albert-heijn)", () => {
		expect(
			validateDeal(deal({ product: "Geen alternatieven gevonden voor dit product." })).reason,
		).toBe("name_is_ui_noise");
	});

	it("rejects navigation prompts (albert-heijn)", () => {
		expect(validateDeal(deal({ product: "Kies een product" })).reason).toBe(
			"name_is_ui_noise",
		);
	});

	it("rejects a price-less product with no promo mechanic", () => {
		const r = validateDeal(deal({ product: "AH Avocado eetrijp 2 stuks" }));
		expect(r.ok).toBe(false);
		expect(r.reason).toBe("no_price_and_no_mechanic");
	});

	it("rejects an implausible price rather than treating it as absent", () => {
		expect(validateDeal(deal({ promoPrice: 0 })).reason).toBe("promo_price_implausible");
		expect(validateDeal(deal({ promoPrice: 999_999 })).reason).toBe(
			"promo_price_implausible",
		);
	});

	it("rejects a promo price above the original", () => {
		expect(validateDeal(deal({ promoPrice: 5, originalPrice: 3 })).reason).toBe(
			"promo_exceeds_original",
		);
	});

	it("rejects names that are too short or have no letters", () => {
		expect(validateDeal(deal({ product: "ab" })).reason).toBe("name_too_short");
		expect(validateDeal(deal({ product: "12,99 €" })).reason).toBe("name_has_no_letters");
	});

	// Every string below is real OCR output from colruyt-2026-w32-viewerimg-*.webp
	it("rejects fragmented OCR output that other rules let through", () => {
		for (const garbage of [
			"sg | | Hamel",
			"RE Se ee tn be aen eend",
			"zij A  ; 1435 gen 69 à",
			"349 | 599 nd",
			"a B dE 0",
			"él  w35 po",
		]) {
			const r = validateDeal(deal({ product: garbage, promoPrice: 9.99 }));
			expect(r.ok, `expected rejection for: ${garbage}`).toBe(false);
			expect(r.reason).toBe("name_is_ocr_noise");
		}
	});

	it("rejects the alcohol warning that leaks into leaflet OCR", () => {
		expect(
			validateDeal(
				deal({ product: "Alcoholmisbruik schaadt de gezondheid", promoPrice: 0.39 }),
			).reason,
		).toBe("name_is_legal_boilerplate");
	});

	it("does not mistake legitimate short product names for OCR noise", () => {
		for (const good of [
			"Coca-Cola 6x1,5L",
			"AH Mango",
			"Stella Artois 24x33cl",
			"Douwe Egberts koffie 500 gram",
		]) {
			expect(
				validateDeal(deal({ product: good, promoPrice: 5.99 })).ok,
				`expected acceptance for: ${good}`,
			).toBe(true);
		}
	});

	// Observed in OCR output from colruyt-2026-w32 leaflet pages.
	it("rejects leaflet annotation that reads as a product", () => {
		for (const fragment of [
			"vb.: Regular",
			"in je winkel ElCoto Blanco",
			"bokalen",
			"bakken",
			"statiegeld.",
			"partyboxen",
			"volledig assortiment",
			"Combineer naar keuze",
		]) {
			const r = validateDeal(deal({ product: fragment, promoPrice: 9.99 }));
			expect(r.ok, `expected rejection for: ${fragment}`).toBe(false);
			expect(r.reason).toBe("name_is_leaflet_fragment");
		}
	});

	// Observed in ici-paris-xl OCR: gift-with-purchase thresholds, not prices.
	it("rejects spend thresholds that would become fictional products", () => {
		for (const threshold of [
			"aan Biotherm producten",
			"bij aankoop min",
			"min. aan Saint Laurent producten",
			"pour tout achat de parfum",
		]) {
			const r = validateDeal(deal({ product: threshold, promoPrice: 65 }));
			expect(r.ok, `expected rejection for: ${threshold}`).toBe(false);
			expect(r.reason).toBe("name_is_leaflet_fragment");
		}
	});

	it("keeps products whose names merely contain a container noun", () => {
		for (const good of [
			"Kwak alle bieren in packs",
			"Leffe alle blikken",
			"Duvel 4 flessen 33cl",
		]) {
			expect(
				validateDeal(deal({ product: good, promoPrice: 12.99 })).ok,
				`expected acceptance for: ${good}`,
			).toBe(true);
		}
	});

	it("accepts a well-formed discounted product", () => {
		expect(
			validateDeal(
				deal({ product: "Coca-Cola 6x1,5L", promoPrice: 5.99, originalPrice: 8.99 }),
			).ok,
		).toBe(true);
	});

	it("accepts a price-less product that carries a real promo mechanic", () => {
		expect(validateDeal(deal({ product: "Douwe Egberts koffie", discount: "1+1 gratis" })).ok).toBe(
			true,
		);
		expect(validateDeal(deal({ product: "Shampoo Nivea 250ml", discount: "-30%" })).ok).toBe(
			true,
		);
	});
});

// ---------------------------------------------------------------------------
// Batch behaviour
// ---------------------------------------------------------------------------

describe("sanitizeDeals", () => {
	it("salvages, keeps and rejects in one pass with reasons", () => {
		const report = sanitizeDeals([
			deal({ id: "a", product: "AH Cherrytomaten 250 gram", discount: "voor0.99" }),
			deal({ id: "b", product: ".st0{fill:#A6A6A6;}", promoPrice: 0.12 }),
			deal({ id: "c", product: "Kies een product" }),
			deal({ id: "d", product: "Coca-Cola 6x1,5L", promoPrice: 5.99 }),
		]);

		expect(report.kept.map((d) => d.id)).toEqual(["a", "d"]);
		expect(report.salvagedCount).toBe(1);
		expect(report.kept[0].promoPrice).toBe(0.99);
		expect(report.rejected.map((r) => r.reason)).toEqual([
			"name_is_css",
			"name_is_ui_noise",
		]);
	});

	it("handles an empty batch", () => {
		expect(sanitizeDeals([])).toEqual({ kept: [], rejected: [], salvagedCount: 0 });
	});
});

describe("implausible discounts", () => {
	// krefel stored seven appliances at "EUR 1.49, was EUR 799" — a thousands
	// separator misread as the price. The OCR clusterer already bounded this;
	// the HTML and page-text paths did not.
	it("rejects a reduction steeper than the plausible bound", () => {
		expect(
			validateDeal({
				product: "Bosch Inbouw vaatwasser SMV4HVX00E",
				promoPrice: 1.49,
				originalPrice: 799,
			} as never),
		).toEqual({ ok: false, reason: "discount_implausible" });
	});

	it("keeps a steep but genuine promotion", () => {
		// 75% off is real in Belgian leaflets; 5x is the bound.
		expect(
			validateDeal({
				product: "Yves Rocher douchegel",
				promoPrice: 2.5,
				originalPrice: 10,
			} as never).ok,
		).toBe(true);
	});

	it("ignores the bound when only one price is present", () => {
		expect(
			validateDeal({ product: "Nectarines", promoPrice: 2.5 } as never).ok,
		).toBe(true);
	});
});
