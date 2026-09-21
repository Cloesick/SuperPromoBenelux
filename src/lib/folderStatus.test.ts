import { describe, expect, it } from "vitest";
import { folderDisplayTitle, folderStatus } from "./folderStatus";

// Lidl's folder, 21-26 September 2026.
const FROM = "2026-09-21";
const UNTIL = "2026-09-26";
const at = (iso: string) => new Date(iso);

describe("folderStatus", () => {
	it("walks a folder through its life", () => {
		expect(folderStatus(FROM, UNTIL, at("2026-09-19T10:00:00Z"))).toEqual({ label: "Start over 2 dagen", tone: "upcoming" });
		expect(folderStatus(FROM, UNTIL, at("2026-09-20T10:00:00Z"))).toEqual({ label: "Start morgen", tone: "upcoming" });
		expect(folderStatus(FROM, UNTIL, at("2026-09-21T06:00:00Z"))).toEqual({ label: "Nieuw vandaag", tone: "new" });
		expect(folderStatus(FROM, UNTIL, at("2026-09-22T10:00:00Z"))).toEqual({ label: "Nog 5 dagen geldig", tone: "active" });
		expect(folderStatus(FROM, UNTIL, at("2026-09-25T10:00:00Z"))).toEqual({ label: "Verloopt morgen", tone: "ending" });
		expect(folderStatus(FROM, UNTIL, at("2026-09-26T22:00:00Z"))).toEqual({ label: "Verloopt vandaag", tone: "ending" });
		expect(folderStatus(FROM, UNTIL, at("2026-09-27T00:30:00Z"))).toEqual({ label: "Verlopen", tone: "expired" });
	});

	it("counts the last day as valid", () => {
		// 22..26 inclusive is five days.
		expect(folderStatus(FROM, UNTIL, at("2026-09-22T23:59:00Z"))?.label).toBe("Nog 5 dagen geldig");
	});

	it("gives nothing for missing or unreadable dates", () => {
		expect(folderStatus(undefined, UNTIL)).toBeNull();
		expect(folderStatus("soon", UNTIL)).toBeNull();
	});
});

describe("folderDisplayTitle", () => {
	it("names a folder by retailer and dates, not by its harvest title", () => {
		expect(folderDisplayTitle("Lidl", { title: "Lidl BE NL - nl folder 21-09-26-09", validFrom: FROM, validUntil: UNTIL })).toBe(
			"Lidl folder 21/09 – 26/09",
		);
	});

	it("keeps the harvest title when dates are missing", () => {
		expect(folderDisplayTitle("Hubo", { title: "2639_NL" })).toBe("2639_NL");
	});
});
