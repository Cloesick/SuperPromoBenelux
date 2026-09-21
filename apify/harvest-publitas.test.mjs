import { describe, expect, it } from "vitest";
import { pagesFromSpreads, spreadsUrl } from "./harvest-publitas.mjs";

// Shape as served by view.publitas.com/aveve/<slug>/spreads.json on 2026-09-21.
const spreads = [
	{ pages: [{ images: { at2400: "/resize/a/p1-2400.jpg", at800: "/resize/a/p1-800.jpg", at200: "/resize/a/p1-200.jpg" } }] },
	{ pages: [
		{ images: { at1600: "/resize/a/p2-1600.jpg", at400: "/resize/a/p2-400.jpg" } },
		{ images: {} },
		{ images: { at2400: "https://cdn.example/p3.jpg" } },
	] },
];

describe("pagesFromSpreads", () => {
	it("numbers pages across spreads, largest image for the page, a small one for the thumbnail", () => {
		const pages = pagesFromSpreads(spreads);
		expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
		expect(pages[0].imageUrl).toBe("https://view.publitas.com/resize/a/p1-2400.jpg");
		expect(pages[0].thumbnailUrl).toBe("https://view.publitas.com/resize/a/p1-800.jpg");
		expect(pages[1].imageUrl).toBe("https://view.publitas.com/resize/a/p2-1600.jpg");
		expect(pages[2].imageUrl).toBe("https://cdn.example/p3.jpg");
	});

	it("returns nothing for a body that is not a spreads list", () => {
		expect(pagesFromSpreads({ status: 404 })).toEqual([]);
		expect(pagesFromSpreads(null)).toEqual([]);
	});
});

describe("spreadsUrl", () => {
	it("builds the publication's spreads.json address", () => {
		expect(spreadsUrl({ groupSlug: "aveve", slug: "vl-p19_folder-dier_2026" })).toBe(
			"https://view.publitas.com/aveve/vl-p19_folder-dier_2026/spreads.json",
		);
		expect(spreadsUrl({})).toBeNull();
	});
});
