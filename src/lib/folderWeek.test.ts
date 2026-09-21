import { describe, expect, it } from "vitest";
import { weekWindow } from "./folderWeek";

// 2026-09-21 is a Monday.
const MON = new Date("2026-09-21T04:30:00Z");
const SUN = new Date("2026-09-27T23:30:00Z");

describe("weekWindow", () => {
	it("keeps Monday–Sunday for Monday retailers and for no stated day", () => {
		expect(weekWindow("maandag", MON)).toEqual({ from: "2026-09-21", until: "2026-09-27" });
		expect(weekWindow(undefined, MON)).toEqual({ from: "2026-09-21", until: "2026-09-27" });
		expect(weekWindow("wekelijks", MON)).toEqual({ from: "2026-09-21", until: "2026-09-27" });
		expect(weekWindow("doorlopend", MON)).toEqual({ from: "2026-09-21", until: "2026-09-27" });
	});

	it("starts on the retailer's own day", () => {
		// Colruyt: Wednesday–Tuesday. Captured Monday, that is last Wednesday's folder.
		expect(weekWindow("woensdag", MON)).toEqual({ from: "2026-09-16", until: "2026-09-22" });
		// Delhaize: Thursday–Wednesday.
		expect(weekWindow("donderdag", MON)).toEqual({ from: "2026-09-17", until: "2026-09-23" });
	});

	it("counts the folder day itself as the first day", () => {
		expect(weekWindow("woensdag", new Date("2026-09-23T04:30:00Z"))).toEqual({
			from: "2026-09-23",
			until: "2026-09-29",
		});
	});

	it("uses the UTC date, so late Sunday is still Sunday", () => {
		expect(weekWindow("maandag", SUN)).toEqual({ from: "2026-09-21", until: "2026-09-27" });
	});
});
