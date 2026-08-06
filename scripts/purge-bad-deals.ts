#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Remove price rows that were written by since-fixed extraction bugs.
//
// Validation now rejects these at the door, but the database is append-only and
// still holds what earlier runs stored. This site's whole premise is telling a
// promo hunter what something costs, so a wrong price is worse than no row.
//
// Two classes, both confirmed against the real data:
//
//   1. Bot-challenge pages read as products. Boots' folder page 1 is an Imperva
//      block; it was OCR'd into "What happened? This blocked by security
//      service request was our Your IP" priced EUR 45.60 down from EUR 193.74 —
//      both numbers sliced out of the IP addresses on the block page. Those
//      three rows are all the Boots data there is.
//
//   2. Reductions steeper than MAX_DISCOUNT_RATIO. krefel holds seven
//      appliances at "EUR 1.49, was EUR 799" — a European thousands separator
//      misparsed, not a promotion.
//
//   npx tsx scripts/purge-bad-deals.ts [--dry-run]
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import { MAX_DISCOUNT_RATIO } from "../src/lib/dealValidation";
import { looksLikeBotChallenge } from "../src/scrapers/botChallenge";

const dbPath = path.join(process.cwd(), "data", "products.db");
const dryRun = process.argv.includes("--dry-run");

if (!fs.existsSync(dbPath)) {
	console.log("No data/products.db — nothing to purge.");
	process.exit(0);
}

const db = new Database(dbPath);
const before = (
	db.prepare("SELECT count(*) n FROM promo_products").get() as { n: number }
).n;

const rows = db
	.prepare(
		"SELECT id, retailer_slug, product_name, promo_price, original_price FROM promo_products",
	)
	.all() as {
	id: number;
	retailer_slug: string;
	product_name: string | null;
	promo_price: number | null;
	original_price: number | null;
}[];

const doomed: (typeof rows)[number] extends never ? never[] : Array<
	(typeof rows)[number] & { why: string }
> = [];
for (const row of rows) {
	const name = (row.product_name ?? "").toLowerCase();

	// looksLikeBotChallenge matches ordered phrases, which is right for a live
	// page but not for these rows: the stored names came out of the OCR
	// clusterer, which reorders words by position. Boots' block page is stored
	// as "This blocked by security service request was our Your IP", so the
	// intact phrase never appears. Match on fragments that survive scrambling
	// and that no genuine product name contains.
	const scrambledChallenge =
		name.includes("security service") ||
		name.includes("incident id") ||
		name.includes("proxy ip") ||
		(name.includes("what happened") && name.includes("your ip"));

	if (looksLikeBotChallenge(row.product_name ?? "") || scrambledChallenge) {
		doomed.push({ ...row, why: "bot-challenge page stored as a product" });
		continue;
	}
	const promo = row.promo_price;
	const original = row.original_price;
	if (
		typeof promo === "number" &&
		typeof original === "number" &&
		promo > 0 &&
		original / promo > MAX_DISCOUNT_RATIO
	) {
		doomed.push({ ...row, why: "discount steeper than the plausible bound" });
	}
}

const byReason = new Map<string, number>();
for (const d of doomed) {
	byReason.set(d.why, (byReason.get(d.why) ?? 0) + 1);
}

console.log(`${before} row(s) in the database, ${doomed.length} to remove.`);
for (const [why, n] of byReason) console.log(`  ${n}  ${why}`);
for (const d of doomed.slice(0, 10)) {
	console.log(
		`    ${d.retailer_slug.padEnd(12)} ${String(d.product_name).slice(0, 46).padEnd(48)} ${d.promo_price} <- ${d.original_price}`,
	);
}
if (doomed.length > 10) console.log(`    ... and ${doomed.length - 10} more`);

if (doomed.length === 0 || dryRun) {
	if (dryRun && doomed.length > 0) {
		console.log("\nDry run — nothing deleted. Re-run without --dry-run to apply.");
	}
	db.close();
	process.exit(0);
}

const del = db.prepare("DELETE FROM promo_products WHERE id = ?");
const runAll = db.transaction((ids: number[]) => {
	for (const id of ids) del.run(id);
});
runAll(doomed.map((d) => d.id));

const after = (
	db.prepare("SELECT count(*) n FROM promo_products").get() as { n: number }
).n;
db.close();

console.log(`\nRemoved ${before - after} row(s); ${after} remain.`);
