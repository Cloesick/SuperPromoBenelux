import { describe, expect, it } from "vitest";
import { createRetailerFolderJsonLd } from "./JsonLd";

// ---------------------------------------------------------------------------
// Leaflet content turns over weekly, so freshness and imagery are the signals
// that matter. The rule these tests protect: never assert a value we do not
// have. A confident-but-wrong dateModified is a worse signal than none, and an
// image URL pointing at a page that was never captured is worse than silence.
// ---------------------------------------------------------------------------

describe("createRetailerFolderJsonLd", () => {
	const full = () =>
		createRetailerFolderJsonLd("Colruyt", "colruyt", {
			validFrom: "2026-08-03",
			validUntil: "2026-08-09",
			scrapedAt: "2026-08-06T04:31:12.000Z",
			coverImageUrl: "/screenshots/colruyt-2026-w32-viewerimg-p1.webp",
			pageCount: 10,
			retailerWebsite: "https://www.colruyt.be",
		}) as Record<string, any>;

	it("states when the folder was last refreshed", () => {
		const d = full();
		expect(d.dateModified).toBe("2026-08-06T04:31:12.000Z");
		expect(d.datePublished).toBe("2026-08-06T04:31:12.000Z");
	});

	it("makes the cover image absolute", () => {
		// A site-relative contentUrl is not resolvable by a crawler reading the
		// JSON out of context.
		const image = full().primaryImageOfPage;
		expect(image["@type"]).toBe("ImageObject");
		expect(image.contentUrl).toMatch(/^https?:\/\/.+\/screenshots\/colruyt-/);
	});

	it("records the real page count", () => {
		expect(full().mainEntity).toMatchObject({
			"@type": "ItemList",
			numberOfItems: 10,
		});
	});

	it("carries the validity range in both machine and human form", () => {
		const d = full();
		expect(d.temporalCoverage).toBe("2026-08-03/2026-08-09");
		expect(d.description).toContain("2026-08-03");
		expect(d.description).toContain("2026-08-09");
	});

	it("attributes the folder to the retailer", () => {
		expect(full().about).toMatchObject({
			"@type": "Organization",
			name: "Colruyt",
			url: "https://www.colruyt.be",
		});
	});

	it("omits every field it has no value for", () => {
		const bare = createRetailerFolderJsonLd("Boots", "boots") as Record<
			string,
			any
		>;
		for (const absent of [
			"dateModified",
			"datePublished",
			"primaryImageOfPage",
			"mainEntity",
			"temporalCoverage",
		]) {
			expect(bare, `${absent} must not be invented`).not.toHaveProperty(absent);
		}
		// The identity of the page is still complete.
		expect(bare["@type"]).toBe("WebPage");
		expect(bare.name).toBe("Boots folder deze week");
		expect(bare.inLanguage).toBe("nl-BE");
	});

	it("omits the page list when the folder has no pages", () => {
		const empty = createRetailerFolderJsonLd("Lidl", "lidl", {
			pageCount: 0,
		}) as Record<string, any>;
		expect(empty).not.toHaveProperty("mainEntity");
	});

	it("leaves an already-absolute cover URL alone", () => {
		const blob = createRetailerFolderJsonLd("ALDI", "aldi", {
			coverImageUrl: "https://cdn.example.com/aldi-p1.webp",
		}) as Record<string, any>;
		expect(blob.primaryImageOfPage.contentUrl).toBe(
			"https://cdn.example.com/aldi-p1.webp",
		);
	});
});
