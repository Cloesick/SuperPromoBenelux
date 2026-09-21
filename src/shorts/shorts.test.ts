import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Brief, publishBlocker } from "./brief";
import { PLATFORMS, isoWeekTag, offerLine, postCopy, trackedLink } from "./captions";

const lidl = Brief.parse(
	JSON.parse(fs.readFileSync(path.join("data", "shorts", "2026-w39", "lidl", "brief.json"), "utf-8")),
);
const folder = { id: "lidl-3355373-folder", validFrom: "2026-09-21", validUntil: "2026-09-26" };

describe("committed briefs", () => {
	it("all parse against the schema", () => {
		const dir = path.join("data", "shorts", "2026-w39");
		for (const slug of fs.readdirSync(dir)) {
			const raw = JSON.parse(fs.readFileSync(path.join(dir, slug, "brief.json"), "utf-8"));
			expect(() => Brief.parse(raw), slug).not.toThrow();
		}
	});
});

describe("publishBlocker", () => {
	const monday = new Date("2026-09-21T08:00:00Z");

	it("lets a current brief through", () => {
		expect(publishBlocker(lidl, folder, monday)).toBeNull();
	});

	it("refuses a brief made from a different folder than the site shows", () => {
		expect(publishBlocker(lidl, { ...folder, id: "lidl-9999999-folder" }, monday)).toMatch(/site shows/);
	});

	it("refuses an ended folder, and one about to end", () => {
		expect(publishBlocker(lidl, folder, new Date("2026-09-27T08:00:00Z"))).toMatch(/ended/);
		expect(publishBlocker(lidl, folder, new Date("2026-09-25T08:00:00Z"))).toMatch(/too close/);
	});

	it("refuses a hero price that is not a price", () => {
		const bad = { ...lidl, offers: [{ ...lidl.offers[0], priceNow: "vanaf 4" }] };
		expect(publishBlocker(bad, folder, monday)).toMatch(/not a price/);
	});

	it("refuses when the retailer has no folder", () => {
		expect(publishBlocker(lidl, null, monday)).toMatch(/no folder/);
	});
});

describe("captions", () => {
	it("tags every link with platform, week and retailer", () => {
		expect(isoWeekTag(new Date("2026-09-21T12:00:00Z"))).toBe("2026-w39");
		const u = new URL(trackedLink(lidl, "tiktok"));
		expect(u.pathname).toBe("/folders/lidl/");
		expect(u.searchParams.get("utm_source")).toBe("tiktok");
		expect(u.searchParams.get("utm_medium")).toBe("social");
		expect(u.searchParams.get("utm_campaign")).toBe("folder-2026-w39");
		expect(u.searchParams.get("utm_content")).toBe("lidl-short");
	});

	it("states prices exactly as the folder prints them", () => {
		expect(offerLine(lidl.offers[0])).toBe("Rund- en varkensgehakt XXL 800 g: €4,29 (was €8,62, -50%)");
	});

	it("writes copy every platform accepts", () => {
		for (const p of PLATFORMS) {
			const c = postCopy(lidl, p);
			expect(c.caption).toContain("21/09 t.e.m. 26/09");
			if (p === "youtube") expect(c.title!.length).toBeLessThanOrEqual(100);
			if (p === "youtube") expect(c.title).toContain("#shorts");
			if (p === "reddit") expect(c.caption).not.toMatch(/#\w/);
			if (p === "tiktok") expect(c.caption.length).toBeLessThanOrEqual(2200);
		}
	});
});
