#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Prune data/ocr-src, the full-resolution capture archive OCR reads from.
//
// Nothing ever deleted from this directory, and every capture the scraper took
// was written there — including the near-identical ones that duplicate
// collapsing now rejects. It reached 834 files / 442 MB holding far less: lidl
// 83 files with 6 distinct images, delhaize 177 with 61, douglas 72 with 6.
//
// Two independent operations:
//
//   Deduplication (default, lossless). Byte-identical files are redundant by
//   definition. The survivor is chosen by the same ranking OCR uses, so the
//   best-named candidate is the one kept.
//
//   Retention (opt-in via --keep-weeks=N). Old weeks are NOT removed by
//   default: this archive is what makes re-extracting a past week possible if
//   the parser improves, and historical prices are the point of the price
//   database. Deleting them is a judgement call, so it must be asked for.
//
//   node scripts/prune-ocr-src.mjs [--dry-run] [--keep-weeks=N]
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "data", "ocr-src");
const dryRun = process.argv.includes("--dry-run");
const keepWeeksArg = process.argv.find((a) => a.startsWith("--keep-weeks="));
const keepWeeks = keepWeeksArg ? parseInt(keepWeeksArg.split("=")[1], 10) : null;

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

/** Same preference order OCR applies, so the kept copy is the useful one. */
function rank(file) {
	if (/-viewerimg-p\d+\./.test(file)) return 0;
	if (/-pdfimg-p\d+\./.test(file)) return 0;
	if (/-pdf-p\d+\./.test(file)) return 1;
	if (/-screenshot-p\d+\./.test(file)) return 2;
	return 3;
}

function pageNumber(file) {
	const m = file.match(/-p(\d+)\./);
	return m ? parseInt(m[1], 10) : 0;
}

/** "colruyt-2026-w32-viewerimg-p1.webp" -> "2026-w32" */
function weekOf(file) {
	const m = file.match(/-(\d{4}-w\d+)-/);
	return m ? m[1] : null;
}

function weekSortKey(week) {
	const m = week.match(/^(\d{4})-w(\d+)$/);
	return m ? parseInt(m[1], 10) * 100 + parseInt(m[2], 10) : 0;
}

function main() {
	if (!fs.existsSync(dir)) {
		console.log("No data/ocr-src directory — nothing to prune.");
		return;
	}

	const files = fs.readdirSync(dir).filter((f) => /\.(webp|png|jpe?g)$/i.test(f));
	if (files.length === 0) {
		console.log("data/ocr-src is empty.");
		return;
	}

	const sizeOf = new Map();
	let totalBytes = 0;
	for (const f of files) {
		const size = fs.statSync(path.join(dir, f)).size;
		sizeOf.set(f, size);
		totalBytes += size;
	}

	const doomed = new Map();

	// --- 1. exact duplicates -------------------------------------------------
	// Grouped per retailer+week so a page that legitimately repeats across weeks
	// is never collapsed into a single copy.
	const groups = new Map();
	for (const f of files) {
		const m = f.match(/^(.+?)-(\d{4}-w\d+)-/);
		const key = m ? `${m[1]}|${m[2]}` : "(other)";
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(f);
	}

	for (const [, members] of groups) {
		const ordered = [...members].sort(
			(a, b) => rank(a) - rank(b) || pageNumber(a) - pageNumber(b),
		);
		const seen = new Set();
		for (const f of ordered) {
			let digest;
			try {
				digest = crypto
					.createHash("md5")
					.update(fs.readFileSync(path.join(dir, f)))
					.digest("hex");
			} catch {
				continue; // Unreadable: leave it alone rather than guess.
			}
			if (seen.has(digest)) doomed.set(f, "duplicate");
			else seen.add(digest);
		}
	}

	// --- 2. retention (opt-in) ----------------------------------------------
	const weeks = [...new Set(files.map(weekOf).filter(Boolean))].sort(
		(a, b) => weekSortKey(b) - weekSortKey(a),
	);

	if (keepWeeks !== null && Number.isFinite(keepWeeks) && keepWeeks > 0) {
		const keep = new Set(weeks.slice(0, keepWeeks));
		for (const f of files) {
			const w = weekOf(f);
			// Files with no parseable week are kept: their age is unknown.
			if (w && !keep.has(w)) doomed.set(f, "old week");
		}
	}

	// --- report and apply ----------------------------------------------------
	const byReason = new Map();
	let freed = 0;
	for (const [f, why] of doomed) {
		byReason.set(why, (byReason.get(why) ?? 0) + 1);
		freed += sizeOf.get(f) ?? 0;
	}

	console.log(
		`data/ocr-src: ${files.length} file(s), ${mb(totalBytes)} MB, ` +
			`weeks ${weeks.join(", ") || "(none)"}`,
	);
	for (const [why, n] of byReason) console.log(`  ${n} ${why}`);

	if (keepWeeks === null && weeks.length > 1) {
		console.log(
			`\nRetention is off. ${weeks.length} week(s) are archived; pass ` +
				"--keep-weeks=N to drop older ones (this loses the ability to " +
				"re-extract those weeks).",
		);
	}

	if (doomed.size === 0) {
		console.log("\nNothing to remove.");
		return;
	}

	if (dryRun) {
		console.log(`\nDry run — would free ${mb(freed)} MB. Re-run without --dry-run.`);
		return;
	}

	for (const f of doomed.keys()) fs.rmSync(path.join(dir, f), { force: true });
	const remaining = fs.readdirSync(dir).length;
	console.log(`\nRemoved ${doomed.size} file(s), freed ${mb(freed)} MB. ${remaining} remain.`);
}

main();
