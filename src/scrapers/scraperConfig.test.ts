import { describe, expect, it } from "vitest";
import { scrapers } from "./scrapers";

describe("scraper config fallback readiness", () => {
	it("every scraper has at least 2 folderUrls for redundancy", () => {
		for (const scraper of scrapers) {
			expect(
				scraper.config.folderUrls.length,
				`${scraper.retailerSlug} should have ≥2 folderUrls`,
			).toBeGreaterThanOrEqual(2);
		}
	});

	it("every scraper has cookieSelectors configured", () => {
		for (const scraper of scrapers) {
			expect(
				scraper.config.cookieSelectors,
				`${scraper.retailerSlug} should have cookieSelectors`,
			).toBeDefined();
			expect(
				scraper.config.cookieSelectors!.length,
				`${scraper.retailerSlug} cookieSelectors should be non-empty`,
			).toBeGreaterThan(0);
		}
	});

	it("all folderUrls are valid HTTP(S) URLs", () => {
		for (const scraper of scrapers) {
			for (const url of scraper.config.folderUrls) {
				expect(
					url.startsWith("http://") || url.startsWith("https://"),
					`${scraper.retailerSlug}: "${url}" should start with http(s)://`,
				).toBe(true);
			}
		}
	});

	it("dealUrls (when present) are valid HTTP(S) URLs", () => {
		for (const scraper of scrapers) {
			if (!scraper.config.dealUrls) continue;
			for (const url of scraper.config.dealUrls) {
				expect(
					url.startsWith("http://") || url.startsWith("https://"),
					`${scraper.retailerSlug}: dealUrl "${url}" should start with http(s)://`,
				).toBe(true);
			}
		}
	});

	it("folderLinkPatterns (when present) are valid RegExp instances", () => {
		for (const scraper of scrapers) {
			if (!scraper.config.folderLinkPatterns) continue;
			for (const pattern of scraper.config.folderLinkPatterns) {
				expect(
					pattern instanceof RegExp,
					`${scraper.retailerSlug}: folderLinkPattern should be RegExp`,
				).toBe(true);
			}
		}
	});

	it("priceSelectors (when present) have at minimum card and name", () => {
		for (const scraper of scrapers) {
			if (!scraper.config.priceSelectors) continue;
			expect(
				typeof scraper.config.priceSelectors.card,
				`${scraper.retailerSlug}: priceSelectors.card should be string`,
			).toBe("string");
			expect(
				typeof scraper.config.priceSelectors.name,
				`${scraper.retailerSlug}: priceSelectors.name should be string`,
			).toBe("string");
		}
	});

	it("no duplicate folderUrls within a single scraper", () => {
		for (const scraper of scrapers) {
			const unique = new Set(scraper.config.folderUrls);
			expect(
				unique.size,
				`${scraper.retailerSlug} has duplicate folderUrls`,
			).toBe(scraper.config.folderUrls.length);
		}
	});

	it("no duplicate dealUrls within a single scraper", () => {
		for (const scraper of scrapers) {
			if (!scraper.config.dealUrls) continue;
			const unique = new Set(scraper.config.dealUrls);
			expect(
				unique.size,
				`${scraper.retailerSlug} has duplicate dealUrls`,
			).toBe(scraper.config.dealUrls.length);
		}
	});
});
