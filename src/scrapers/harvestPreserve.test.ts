import { describe, expect, it } from "vitest";
// @ts-expect-error — plain .mjs harvester, no type declarations.
import { preserveRenderedPages } from "../../apify/harvest-publitas.mjs";

/**
 * The Publitas harvest cannot produce page images: Publitas signs them and
 * loads them lazily, so the harvester writes `pages: []` and lets the PDF carry
 * the folder. scripts/backfill-pdf-pages.mts renders them afterwards.
 *
 * The harvest then wrote the whole folder JSON back, deleting every rendered
 * page. It runs twice a day and 14 retailers depend on it, so their folders
 * were emptied within hours of being filled — with nothing failing anywhere.
 */
describe("preserveRenderedPages", () => {
	const withPages = (over: Record<string, unknown> = {}) => ({
		folders: [
			{
				id: "jumbo-123-folder",
				pdfUrl: "https://view.publitas.com/171/3276357/pdfs/a.pdf",
				pageCount: 27,
				thumbnailUrl: "/screenshots/jumbo-2026-w32-pdfimg-p1.webp",
				pages: Array.from({ length: 27 }, (_, i) => ({
					pageNumber: i + 1,
					imageUrl: `/screenshots/jumbo-2026-w32-pdfimg-p${i + 1}.webp`,
				})),
				...over,
			},
		],
	});

	const freshHarvest = (over: Record<string, unknown> = {}) => ({
		folders: [
			{
				id: "jumbo-123-folder",
				pdfUrl: "https://view.publitas.com/171/3276357/pdfs/a.pdf",
				pageCount: 27,
				thumbnailUrl: "https://view.publitas.com/171/3276357/pages/abc-at800.jpg",
				pages: [],
				...over,
			},
		],
	});

	it("keeps rendered pages when the harvest returns the same issue", () => {
		const out = preserveRenderedPages(withPages(), freshHarvest());
		expect(out.folders[0].pages).toHaveLength(27);
		expect(out.folders[0].pageCount).toBe(27);
	});

	it("keeps the locally rendered cover, not the remote one", () => {
		const out = preserveRenderedPages(withPages(), freshHarvest());
		expect(out.folders[0].thumbnailUrl).toBe(
			"/screenshots/jumbo-2026-w32-pdfimg-p1.webp",
		);
	});

	it("drops them for a new issue — last week's pages are wrong content", () => {
		const out = preserveRenderedPages(
			withPages(),
			freshHarvest({ id: "jumbo-999-folder", pdfUrl: "https://view.publitas.com/171/9/pdfs/b.pdf" }),
		);
		expect(out.folders[0].pages).toHaveLength(0);
	});

	it("drops them when the PDF changed under the same id", () => {
		// The id is derived from the manifest, so a re-published issue can keep it
		// while the content changes. The PDF is the sharper signal.
		const out = preserveRenderedPages(
			withPages(),
			freshHarvest({ pdfUrl: "https://view.publitas.com/171/3276357/pdfs/DIFFERENT.pdf" }),
		);
		expect(out.folders[0].pages).toHaveLength(0);
	});

	it("is a no-op when there is nothing on disk yet", () => {
		const out = preserveRenderedPages(null, freshHarvest());
		expect(out.folders[0].pages).toHaveLength(0);
	});
});
