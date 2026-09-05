import { describe, expect, it } from "vitest";
import {
	assessStaleness,
	formatStalenessReport,
	hasCriticalStaleness,
	isPriced,
} from "./staleness";

const TODAY = new Date("2026-09-05T12:00:00Z");

const priced = (n: number) => ({ promoPrice: n, originalPrice: n + 1 });
const unpriced = () => ({ promoPrice: undefined, originalPrice: undefined });

describe("isPriced", () => {
	it("counts a finite promo price and nothing else", () => {
		expect(isPriced(priced(1.85))).toBe(true);
		expect(isPriced(unpriced())).toBe(false);
		expect(isPriced({ promoPrice: NaN })).toBe(false);
		// An original price alone is a strikethrough with nothing to sell.
		expect(isPriced({ originalPrice: 3.7 })).toBe(false);
	});
});

describe("assessStaleness", () => {
	it("passes a current folder with priced deals", () => {
		const v = assessStaleness(
			{
				slug: "lidl",
				validUntil: "2026-09-12",
				deals: [priced(1.85), priced(2.97)],
				folderCount: 1,
			},
			TODAY,
		);
		expect(v.level).toBe("ok");
		expect(v.pricedCount).toBe(2);
	});

	it("flags an expired folder and counts the days", () => {
		const v = assessStaleness(
			{
				slug: "lidl",
				validUntil: "2026-08-09",
				deals: [priced(1.85)],
				folderCount: 1,
			},
			TODAY,
		);
		expect(v.level).toBe("expired");
		expect(v.daysExpired).toBe(26);
	});

	it("flags deals that arrive with no prices — the silent selector break", () => {
		const v = assessStaleness(
			{
				slug: "lidl",
				validUntil: "2026-09-12",
				deals: [unpriced(), unpriced(), unpriced()],
				folderCount: 1,
			},
			TODAY,
		);
		expect(v.level).toBe("blind");
		expect(v.dealCount).toBe(3);
		expect(v.pricedCount).toBe(0);
	});

	it("reports nothing stored as empty rather than merely stale", () => {
		const v = assessStaleness(
			{ slug: "welkoop", validUntil: null, deals: [], folderCount: 0 },
			TODAY,
		);
		expect(v.level).toBe("empty");
	});

	it("prefers expired over blind when a folder is both", () => {
		// Expiry is the actionable fact; a blind scraper on a dead folder is one
		// problem, not two, and the folder is what a reader sees first.
		const v = assessStaleness(
			{
				slug: "aldi",
				validUntil: "2026-08-08",
				deals: [unpriced()],
				folderCount: 1,
			},
			TODAY,
		);
		expect(v.level).toBe("expired");
	});

	it("warns the day before expiry rather than after", () => {
		const v = assessStaleness(
			{
				slug: "colruyt",
				validUntil: "2026-09-05",
				deals: [priced(2)],
				folderCount: 1,
			},
			TODAY,
		);
		expect(v.level).toBe("expiring");
	});

	it("does not invent an expiry from an unparseable date", () => {
		const v = assessStaleness(
			{
				slug: "spar",
				validUntil: "not-a-date",
				deals: [priced(2)],
				folderCount: 1,
			},
			TODAY,
		);
		expect(v.daysExpired).toBeNull();
		expect(v.level).toBe("ok");
	});
});

describe("formatStalenessReport", () => {
	it("puts the worst first and summarises the rest", () => {
		const out = formatStalenessReport([
			assessStaleness(
				{ slug: "ok-one", validUntil: "2026-09-30", deals: [priced(1)], folderCount: 1 },
				TODAY,
			),
			assessStaleness(
				{ slug: "gone", validUntil: null, deals: [], folderCount: 0 },
				TODAY,
			),
			assessStaleness(
				{ slug: "dark", validUntil: "2026-09-30", deals: [unpriced()], folderCount: 1 },
				TODAY,
			),
		]);
		const lines = out.split("\n");
		expect(lines[0]).toContain("3 retailer(s) need attention");
		expect(lines[1]).toContain("gone"); // empty sorts above blind
		expect(lines[2]).toContain("dark");
		expect(lines[3]).toContain("ok-one");
	});

	it("says so plainly when everything is current", () => {
		const out = formatStalenessReport([
			assessStaleness(
				{ slug: "lidl", validUntil: "2026-09-30", deals: [priced(1)], folderCount: 1 },
				TODAY,
			),
		]);
		expect(out).toContain("All 1 retailer(s) current.");
	});

	it("handles an empty estate without throwing", () => {
		expect(formatStalenessReport([])).toBe("No retailers assessed.");
	});
});

describe("hasCriticalStaleness", () => {
	it("treats blind, expired and empty as build-failing but not expiring", () => {
		const mk = (validUntil: string | null, deals: { promoPrice?: number }[], folders = 1) =>
			assessStaleness({ slug: "x", validUntil, deals, folderCount: folders }, TODAY);

		expect(hasCriticalStaleness([mk("2026-08-01", [priced(1)])])).toBe(true);
		expect(hasCriticalStaleness([mk("2026-09-30", [unpriced()])])).toBe(true);
		expect(hasCriticalStaleness([mk(null, [], 0)])).toBe(true);
		expect(hasCriticalStaleness([mk("2026-09-05", [priced(1)])])).toBe(false);
		expect(hasCriticalStaleness([mk("2026-09-30", [priced(1)])])).toBe(false);
	});
});
