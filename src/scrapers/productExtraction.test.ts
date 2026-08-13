import { describe, expect, it } from "vitest";
import { EXTRACTION_PROMPT, EXTRACTION_SCHEMA } from "./productExtraction";

// ---------------------------------------------------------------------------
// The schema is the contract with the model. Structured outputs reject any
// response that does not match it, so a wrong schema fails every page at once.
// ---------------------------------------------------------------------------

describe("EXTRACTION_SCHEMA", () => {
	it("requires additionalProperties false at every object level", () => {
		// Structured outputs reject schemas that allow extra keys.
		expect(EXTRACTION_SCHEMA.additionalProperties).toBe(false);
		const item = EXTRACTION_SCHEMA.properties.products.items;
		expect(item.additionalProperties).toBe(false);
	});

	it("asks for prices in integer cents, never floats", () => {
		const props = EXTRACTION_SCHEMA.properties.products.items.properties;
		expect(props.priceCents.type).toEqual(["integer", "null"]);
		expect(props.originalPriceCents.type).toEqual(["integer", "null"]);
	});

	it("requires every field so the model cannot silently omit one", () => {
		const item = EXTRACTION_SCHEMA.properties.products.items;
		expect(item.required).toEqual([
			"brand",
			"name",
			"variant",
			"sizeText",
			"priceCents",
			"originalPriceCents",
			"promoLabel",
			"confidence",
		]);
	});
});

describe("EXTRACTION_PROMPT", () => {
	it("tells the model to omit rather than guess an unreadable price", () => {
		// A guessed price is worse than a missing one: it looks valid downstream.
		expect(EXTRACTION_PROMPT).toMatch(/null/);
		expect(EXTRACTION_PROMPT.toLowerCase()).toContain("do not guess");
	});

	it("names the cents convention explicitly", () => {
		expect(EXTRACTION_PROMPT).toContain("449");
	});
});
