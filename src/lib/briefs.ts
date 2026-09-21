// ---------------------------------------------------------------------------
// The weekly cover analysis (data/shorts/<week>/<slug>/brief.json), read back
// for the site itself.
//
// The shorts pipeline already extracts each folder's hero offers exactly as
// printed: product, pack size, price, struck price, mechanic. Shown on the
// retailer page, that is original, readable text about this week's deals,
// which is what the site lacked. AdSense rejected it for "low value content",
// and a page that is only an embedded leaflet gives search engines nothing to
// index.
//
// A brief is used only when its folderId is the folder the site shows now, so
// a page can never describe last week's offers.
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import { Brief } from "@/shorts/brief";
import { offerLine } from "@/shorts/captions";

const SHORTS_DIR = path.join(process.cwd(), "data", "shorts");

export function getBriefForFolder(retailerSlug: string, folderId: string | undefined): Brief | null {
	if (!folderId || !fs.existsSync(SHORTS_DIR)) return null;
	// Newest week first, so a re-briefed folder uses its latest reading.
	const weeks = fs.readdirSync(SHORTS_DIR).sort().reverse();
	for (const week of weeks) {
		const file = path.join(SHORTS_DIR, week, retailerSlug, "brief.json");
		if (!fs.existsSync(file)) continue;
		try {
			const brief = Brief.parse(JSON.parse(fs.readFileSync(file, "utf-8")));
			if (brief.folderId === folderId) return brief;
		} catch {
			// A malformed brief is skipped, never shown half-read.
		}
	}
	return null;
}

/** "21 september" from "2026-09-21", as a calendar date. */
export function longDate(iso: string): string {
	return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("nl-BE", {
		timeZone: "UTC",
		day: "numeric",
		month: "long",
	});
}

/**
 * One plain-language paragraph about the folder, built only from what the
 * folder prints: "De Lidl folder van 21 september tot en met 26 september
 * opent met Rund- en varkensgehakt XXL (800 g) voor €4,29 in plaats van
 * €8,62, -50%."
 */
export function folderSummary(brief: Brief): string {
	const hero = brief.offers[0];
	const name = hero.detail ? `${hero.product} (${hero.detail})` : hero.product;
	let deal: string;
	if (hero.priceNow) {
		deal = `voor €${hero.priceNow}`;
		if (hero.priceWas) deal += ` in plaats van €${hero.priceWas}`;
		if (hero.mechanic) deal += `, ${hero.mechanic}`;
	} else {
		deal = hero.mechanic ? `met ${hero.mechanic}` : "";
	}
	const more =
		brief.offers.length > 1
			? ` Verder in de kijker: ${brief.offers
					.slice(1)
					.map((o) => o.product)
					.join(" en ")}.`
			: "";
	return `De ${brief.retailerName} folder van ${longDate(brief.validFrom)} tot en met ${longDate(brief.validUntil)} opent met ${name} ${deal}.`.replace(/ \./, ".") + more;
}

export { offerLine };
