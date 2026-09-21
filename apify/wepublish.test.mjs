import { describe, expect, it } from "vitest";
import { WEPUBLISH, candidateSlugs, validityFromSlug, wepublishFolder } from "./wepublish.mjs";

// Monday of ISO week 39.
const TODAY = new Date("2026-09-21T05:30:00Z");

describe("candidateSlugs", () => {
	it("tries the weeks from two back to one ahead, in each retailer's scheme", () => {
		expect(candidateSlugs(WEPUBLISH.carrefour, TODAY)).toEqual([
			"carrefour-week-37-39-2026",
			"carrefour-week-38-40-2026",
			"carrefour-week-39-41-2026",
			"carrefour-week-40-42-2026",
		]);
		expect(candidateSlugs(WEPUBLISH.delhaize, TODAY)).toContain("delhaize-benl-week-38-2026");
	});
});

describe("validityFromSlug", () => {
	// Each expectation is the range printed on that folder's cover.
	it("matches Carrefour's printed Wednesday-to-Monday range", () => {
		expect(validityFromSlug("carrefour-week-39-41-2026", "woensdag", 13)).toMatchObject({ from: "2026-09-23", until: "2026-10-05" });
		expect(validityFromSlug("carrefour-week-38-40-2026", "woensdag", 13)).toMatchObject({ from: "2026-09-16", until: "2026-09-28" });
	});

	it("matches Kruidvat's two weeks from Tuesday and Delhaize's Thursday week", () => {
		expect(validityFromSlug("kruidvat-benl-week-39-2026", "dinsdag", 13)).toMatchObject({ from: "2026-09-22", until: "2026-10-04" });
		expect(validityFromSlug("delhaize-benl-week-38-2026", "donderdag", 7)).toMatchObject({ from: "2026-09-17", until: "2026-09-23" });
	});

	it("returns null for a slug without week numbers", () => {
		expect(validityFromSlug("carrefour-special", "woensdag", 13)).toBeNull();
	});
});

describe("wepublishFolder", () => {
	it("points at the PDF for the render step to turn into pages", () => {
		const f = wepublishFolder("carrefour", "carrefour-week-38-40-2026", { from: "2026-09-16", until: "2026-09-29" });
		expect(f.pdfUrl).toBe("https://api.wepublish.digital/viewer/pdf/download/carrefour-week-38-40-2026");
		expect(f.pages).toEqual([]);
		expect(f.id).toBe("carrefour-carrefour-week-38-40-2026-folder");
	});
});
