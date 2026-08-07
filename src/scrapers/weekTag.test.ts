import { describe, expect, it } from "vitest";
import { BaseScraper, type ScrapeContext } from "./base";

// ---------------------------------------------------------------------------
// Week tagging decides the filename prefix for every capture, and
// findScreenshots() selects OCR input by that prefix. It only misbehaves across
// New Year, so a mistake here stays invisible for eleven months and then
// silently swaps in a year-old leaflet.
// ---------------------------------------------------------------------------

class TestScraper extends BaseScraper {
	config = { slug: "test", name: "Test", folderUrls: ["https://example.com"] };

	tagFor(date: Date) {
		return this.currentWeekTag(date);
	}

	isoFor(date: Date) {
		return this.getIsoWeek(date);
	}
}

/** Midday UTC keeps the local-time conversion away from a date boundary. */
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("ISO week tagging", () => {
	const scraper = new TestScraper();

	it("gives every day of a week the same tag", () => {
		// Mon 3 Aug through Sun 9 Aug 2026 is one leaflet week.
		const tags = [
			"2026-08-03",
			"2026-08-04",
			"2026-08-06",
			"2026-08-09",
		].map((d) => scraper.tagFor(at(d)));
		expect(new Set(tags).size, `tags were ${tags.join(", ")}`).toBe(1);
		expect(tags[0]).toBe("2026-w32");
	});

	it("rolls to a new tag on Monday", () => {
		expect(scraper.tagFor(at("2026-08-09"))).toBe("2026-w32");
		expect(scraper.tagFor(at("2026-08-10"))).toBe("2026-w33");
	});

	it("keeps one tag across New Year", () => {
		// ISO week 53 of 2026 runs Mon 28 Dec 2026 to Sun 3 Jan 2027. Pairing the
		// ISO week with the calendar year split it into "2026-w53" and
		// "2027-w53", so a scrape mid-week abandoned Monday's captures.
		const tags = [
			"2026-12-28",
			"2026-12-31",
			"2027-01-01",
			"2027-01-03",
		].map((d) => scraper.tagFor(at(d)));
		expect(new Set(tags).size, `tags were ${tags.join(", ")}`).toBe(1);
		expect(tags[0]).toBe("2026-w53");
	});

	it("labels a late-December week that belongs to the next year", () => {
		// Mon 29 Dec 2025 is ISO 2026-W01. Tagging it "2025-w1" collided with the
		// first week of January 2025 — a year-old capture read as this week's.
		expect(scraper.tagFor(at("2025-12-29"))).toBe("2026-w1");
		expect(scraper.tagFor(at("2026-01-01"))).toBe("2026-w1");
	});

	it("does not reuse a tag for two different weeks in the same year", () => {
		// The January and December weeks of 2025 must never collide.
		expect(scraper.tagFor(at("2025-01-02"))).not.toBe(
			scraper.tagFor(at("2025-12-29")),
		);
	});

	it("reports the ISO year alongside the week", () => {
		expect(scraper.isoFor(at("2025-12-29"))).toEqual({ year: 2026, week: 1 });
		expect(scraper.isoFor(at("2026-08-03"))).toEqual({ year: 2026, week: 32 });
	});
});

export type { ScrapeContext };
