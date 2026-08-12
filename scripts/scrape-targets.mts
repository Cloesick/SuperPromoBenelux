#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Which retailers to scrape today.
//
// The scrape ran daily and full. The folders do not: every retailer with a
// named publication day in retailers.ts turns over once a week, so six of every
// seven runs re-scraped 45 retailers to find nothing changed.
//
// Worse, 14 retailers are marked `doorlopend` — rolling promotions, no folder
// at all. Their median page count is 1, against 20–34 for every retailer with a
// named day. Scraping them weekly was never going to produce a leaflet.
//
// The groups come from `seo.folderDay`, so adding a retailer to retailers.ts
// puts it in the right group automatically. A hardcoded list here would drift
// away from the data within a month.
//
//   npx tsx scripts/scrape-targets.mts            # today, by UTC weekday
//   npx tsx scripts/scrape-targets.mts --day 1    # Monday
//   npx tsx scripts/scrape-targets.mts --monthly  # the doorlopend group
//   npx tsx scripts/scrape-targets.mts --explain  # show every group
//
// Prints a space-separated slug list for `npm run scrape -- $(…)`.
// ---------------------------------------------------------------------------

import { allRetailers } from "../src/lib/retailers";
import { scrapers } from "../src/scrapers/scrapers";

/** Dutch weekday → JS getUTCDay() number. */
const WEEKDAY: Record<string, number> = {
	zondag: 0,
	maandag: 1,
	dinsdag: 2,
	woensdag: 3,
	donderdag: 4,
	vrijdag: 5,
	zaterdag: 6,
};

/**
 * Cadences that mean "no weekly folder".
 *
 * `doorlopend` retailers run rolling promotions — Zalando, Coolblue, bol, H&M.
 * They still get scraped, for deals and in case a folder appears, but monthly
 * rather than weekly.
 */
const MONTHLY = new Set(["doorlopend", "maandelijks", "tweewekelijks"]);

/** Retailers with a scraper here; the rest come from the Apify harvest. */
const SCRAPEABLE = new Set(scrapers.map((s) => s.retailerSlug));

interface Group {
	/** 0–6 for a weekday, or "monthly". */
	when: number | "monthly";
	slugs: string[];
}

function groupFor(folderDay: string | undefined): number | "monthly" {
	const day = (folderDay ?? "").toLowerCase().trim();
	if (MONTHLY.has(day)) return "monthly";
	if (day in WEEKDAY) return WEEKDAY[day];
	// "wekelijks" and anything unstated: weekly, day unknown. Monday is both the
	// most common publication day and the start of the retail week, so a folder
	// published any other day is at most six days stale rather than missed.
	return 1;
}

function buildGroups(): Map<number | "monthly", string[]> {
	const groups = new Map<number | "monthly", string[]>();
	for (const retailer of allRetailers) {
		// Retailers without a scraper are refreshed by harvest-publitas.yml.
		if (!SCRAPEABLE.has(retailer.slug)) continue;
		const key = groupFor(retailer.seo?.folderDay);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(retailer.slug);
	}
	for (const list of groups.values()) list.sort();
	return groups;
}

const args = process.argv.slice(2);
const groups = buildGroups();

if (args.includes("--explain")) {
	const names = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
	let total = 0;
	for (const [when, slugs] of [...groups].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
		const label = when === "monthly" ? "monthly" : names[when];
		console.log(`${label.padEnd(10)} ${String(slugs.length).padStart(2)}  ${slugs.join(" ")}`);
		total += slugs.length;
	}
	console.log(`\n${total} scraper-backed retailer(s) across ${groups.size} group(s).`);
	process.exit(0);
}

const key: number | "monthly" = args.includes("--monthly")
	? "monthly"
	: args.includes("--day")
		? Number(args[args.indexOf("--day") + 1])
		: new Date().getUTCDay();

// An empty group is normal — most weekdays have none — and must exit 0 so the
// workflow can skip cleanly rather than fail.
console.log((groups.get(key) ?? []).join(" "));
