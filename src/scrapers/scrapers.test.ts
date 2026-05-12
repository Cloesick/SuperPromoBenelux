import { describe, expect, it } from "vitest";
import { scrapers } from "./scrapers";

describe("scrapers", () => {
	it("has at least one scraper", () => {
		expect(scrapers.length).toBeGreaterThan(0);
	});

	it("scraper slugs are unique", () => {
		const slugs = scrapers.map((s) => s.retailerSlug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it("each scraper exposes required config", () => {
		for (const scraper of scrapers) {
			expect(scraper.retailerSlug).toBeTruthy();
			expect(scraper.retailerName).toBeTruthy();
			expect(scraper.config.slug).toBe(scraper.retailerSlug);
			expect(Array.isArray(scraper.config.folderUrls)).toBe(true);
			expect(scraper.config.folderUrls.length).toBeGreaterThan(0);
			for (const url of scraper.config.folderUrls) {
				expect(typeof url).toBe("string");
				expect(url.startsWith("http")).toBe(true);
			}
		}
	});
});
