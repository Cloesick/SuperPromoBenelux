import { describe, expect, it } from "vitest";
import type { ScrapedData } from "../lib/types";

function validateScrapedDataContract(data: ScrapedData) {
	expect(typeof data.retailer).toBe("string");
	expect(Array.isArray(data.folders)).toBe(true);
	expect(Array.isArray(data.deals)).toBe(true);
	expect(typeof data.scrapedAt).toBe("string");

	for (const folder of data.folders) {
		expect(folder.retailerSlug).toBe(data.retailer);
		expect(typeof folder.title).toBe("string");
		expect(Array.isArray(folder.pages)).toBe(true);
		expect(folder.pageCount).toBe(folder.pages.length);

		if (folder.pages.length > 0) {
			expect(folder.thumbnailUrl).toBeTruthy();
			// pages must be sequential
			for (let i = 0; i < folder.pages.length; i++) {
				expect(folder.pages[i].pageNumber).toBe(i + 1);
				expect(typeof folder.pages[i].imageUrl).toBe("string");
				expect(folder.pages[i].imageUrl.length).toBeGreaterThan(0);
			}
		}

		// If we are relying on screenshots for an embed-based viewer, make sure it's not a single-page regression.
		const methods = new Set(data.methods ?? []);
		const isEmbedViewer =
			folder.contentSource === "issuu" || folder.contentSource === "publitas";
		if (isEmbedViewer && methods.has("screenshot")) {
			expect(folder.pages.length).toBeGreaterThan(1);
		}
	}
}

describe("scraper output contract", () => {
	it("enforces invariants for screenshot-rendered Issuu folder", () => {
		const data: ScrapedData = {
			retailer: "colruyt",
			folders: [
				{
					id: "colruyt-2026-w14-folder",
					retailerSlug: "colruyt",
					title: "Colruyt folder van de week",
					validFrom: "2026-03-30",
					validUntil: "2026-04-05",
					pageCount: 3,
					thumbnailUrl: "/screenshots/p1.png",
					pages: [
						{ pageNumber: 1, imageUrl: "/screenshots/p1.png", deals: [] },
						{ pageNumber: 2, imageUrl: "/screenshots/p2.png", deals: [] },
						{ pageNumber: 3, imageUrl: "/screenshots/p3.png", deals: [] },
					],
					embedUrl: "https://e.issuu.com/embed.html?...",
					contentSource: "issuu",
					scrapedAt: new Date().toISOString(),
				},
			],
			deals: [],
			scrapedAt: new Date().toISOString(),
			sourceUrls: ["https://www.colruyt.be/nl/folders"],
			methods: ["issuu", "screenshot"],
		};

		validateScrapedDataContract(data);
	});

	it("enforces invariants for screenshot-rendered Publitas folder", () => {
		const data: ScrapedData = {
			retailer: "delhaize",
			folders: [
				{
					id: "delhaize-2026-w14-folder",
					retailerSlug: "delhaize",
					title: "Delhaize folder van de week",
					validFrom: "2026-03-30",
					validUntil: "2026-04-05",
					pageCount: 2,
					thumbnailUrl: "/screenshots/p1.png",
					pages: [
						{ pageNumber: 1, imageUrl: "/screenshots/p1.png", deals: [] },
						{ pageNumber: 2, imageUrl: "/screenshots/p2.png", deals: [] },
					],
					embedUrl: "https://view.publitas.com/x/y/page/1?...",
					pdfUrl: "https://view.publitas.com/...pdf?...",
					contentSource: "publitas",
					scrapedAt: new Date().toISOString(),
				},
			],
			deals: [],
			scrapedAt: new Date().toISOString(),
			sourceUrls: ["https://www.delhaize.be/nl/folder"],
			methods: ["publitas", "screenshot"],
		};

		validateScrapedDataContract(data);
	});
});
