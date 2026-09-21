import { describe, expect, it } from "vitest";
import { inferValidity, isoWeekMonday, rejectReason } from "./folderDates.mjs";

// The harvest that published Lidl 2025 and MediaMarkt's December folder as
// current ran on this day. Every title below is verbatim from that run.
const TODAY = new Date("2026-09-21T05:30:00Z");
const v = (title, url = "") => inferValidity(title, url, TODAY);
const verdict = (title, url = "") => rejectReason(v(title, url), TODAY);

describe("isoWeekMonday", () => {
	it("matches the ISO calendar", () => {
		expect(isoWeekMonday(2026, 39).toISOString().slice(0, 10)).toBe("2026-09-21");
		expect(isoWeekMonday(2026, 1).toISOString().slice(0, 10)).toBe("2025-12-29");
	});
});

describe("inferValidity", () => {
	it("prefers a stated day range over the week number beside it", () => {
		expect(v("Jumbo actiefolder - week 39 - 23 september t/m 29 september")).toMatchObject({
			from: "2026-09-23",
			until: "2026-09-29",
		});
		expect(v("XENOS - Xenos week 39-40 2026 (ma 21-9 t/m zo 4-10)")).toMatchObject({
			from: "2026-09-21",
			until: "2026-10-04",
		});
	});

	it("reads French ranges", () => {
		expect(
			v("Mr Bricolage Belgique - Folder 13 - du 08 septembre au 1er octobre"),
		).toMatchObject({ from: "2026-09-08", until: "2026-10-01" });
	});

	it("reads Lidl's dates from the URL when the title has none", () => {
		expect(
			v("Lidl BE NL - nl folder", "https://folder-nl.lidl.be/nl-folder-21-09-26-09"),
		).toMatchObject({ from: "2026-09-21", until: "2026-09-26" });
	});

	it("reads week numbers in their several spellings", () => {
		expect(v("AH - Bonus-week-39-2026")).toMatchObject({ from: "2026-09-21", until: "2026-09-27" });
		expect(v("Hoogvliet folder week 39")).toMatchObject({ from: "2026-09-21" });
		expect(v("HORNBACH NL - WH_0926_NL_KW38")).toMatchObject({ from: "2026-09-14", until: "2026-09-20" });
		expect(v("SPAR - SPAR folder wk20263738")).toMatchObject({ from: "2026-09-07", until: "2026-09-20" });
		expect(v("2639_NL")).toMatchObject({ from: "2026-09-21", until: "2026-09-27" });
	});

	it("returns null when the folder states nothing", () => {
		expect(v("Gifi - Gifi Bi-monthly ")).toBeNull();
		expect(v("-50% op de 2de broek")).toBeNull();
		expect(v("Supra Bazar - Dierenfolder 10 26")).toBeNull();
	});

	it("puts a yearless date in the year nearest today", () => {
		const dec = new Date("2026-12-28T00:00:00Z");
		expect(inferValidity("ma 28-12 t/m zo 3-1", "", dec)).toMatchObject({
			from: "2026-12-28",
			until: "2027-01-03",
		});
	});
});

describe("rejectReason", () => {
	it("rejects last year's Lidl folder served from this year's URL", () => {
		// Its URL range 17-09..23-09 alone would look current. The title decides.
		expect(
			verdict("Lidl BE NL - Week 38 2025", "https://folder-nl.lidl.be/nl-folder-17-09-23-09"),
		).toMatch(/ended 2025-09-21/);
	});

	it("rejects a folder dated months ahead", () => {
		expect(verdict("A Media Markt BE - W50 EOY NL")).toMatch(/starts 2026-12-07/);
	});

	it("rejects a folder whose week is over", () => {
		expect(verdict("PLUS - PLUS week 38 2026")).toMatch(/ended 2026-09-20/);
		expect(verdict("2635_NL")).toMatch(/ended/);
	});

	it("accepts this week, next week, and folders that state nothing", () => {
		expect(verdict("AH - Bonus-week-39-2026")).toBeNull();
		expect(verdict("Blokker - Blokker week 40 2026")).toBeNull();
		expect(verdict("Gifi - Gifi Bi-monthly ")).toBeNull();
	});
});
