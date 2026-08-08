#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Remove blank page captures from folder data.
//
// The scraper rejects blank captures at source (BaseScraper.isBlankCapture),
// but one branch — the PDF-scroll fallback — wrote screenshots straight to
// disk and skipped that check for as long as it existed. Zalando shipped a
// single 1440x900 image whose pixels had a standard deviation of 0.0, a
// uniformly blank frame, as its entire folder; the page was indexed on the
// strength of having "a page".
//
// The capture path is fixed, but data already written still carries whatever
// it produced. This removes those pages so the viewer falls through to the
// retailer's embed, its PDF, or an honest empty state.
//
//   node scripts/prune-blank-pages.mjs [--dry-run]
//
// Uses the same measure as the scraper — mean per-channel standard deviation —
// so a page removed here is one the scraper would refuse today.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/** Matches BaseScraper.BLANK_STDDEV_THRESHOLD. */
const BLANK_STDDEV_THRESHOLD = 3;

const root = process.cwd();
const foldersDir = path.join(root, "data", "folders");
const publicDir = path.join(root, "public");
const dryRun = process.argv.includes("--dry-run");

/** Mean per-channel standard deviation, or null when it cannot be measured. */
async function flatness(file) {
	try {
		const { channels } = await sharp(fs.readFileSync(file), {
			limitInputPixels: false,
		}).stats();
		if (!channels?.length) return null;
		return channels.reduce((sum, c) => sum + c.stdev, 0) / channels.length;
	} catch {
		// Unreadable is not the same as blank. Leave it alone rather than
		// deleting a real page over a decoding problem.
		return null;
	}
}

let removed = 0;
let scanned = 0;
const touched = [];

for (const file of fs.readdirSync(foldersDir).filter((f) => f.endsWith(".json"))) {
	const full = path.join(foldersDir, file);
	const slug = file.replace(/\.json$/, "");
	let data;
	try {
		data = JSON.parse(fs.readFileSync(full, "utf-8"));
	} catch {
		console.warn(`  skipped ${file}: not valid JSON`);
		continue;
	}

	let changed = false;
	for (const folder of data.folders ?? []) {
		const kept = [];
		for (const page of folder.pages ?? []) {
			scanned++;
			const onDisk =
				page.imageUrl?.startsWith("/") && path.join(publicDir, page.imageUrl.slice(1));
			if (!onDisk || !fs.existsSync(onDisk)) {
				kept.push(page);
				continue;
			}
			const sd = await flatness(onDisk);
			if (sd !== null && sd < BLANK_STDDEV_THRESHOLD) {
				console.log(
					`  ${slug} page ${page.pageNumber}: stdev ${sd.toFixed(2)} — blank, removing`,
				);
				removed++;
				changed = true;
				continue;
			}
			kept.push(page);
		}
		if (changed) {
			// Renumber so the viewer's "Pagina n van m" stays contiguous.
			folder.pages = kept.map((p, i) => ({ ...p, pageNumber: i + 1 }));
			folder.pageCount = folder.pages.length;
			// A cover pointing at a removed page would 404 behind full chrome.
			if (
				folder.thumbnailUrl &&
				!folder.pages.some(
					(p) => p.imageUrl === folder.thumbnailUrl || p.thumbnailUrl === folder.thumbnailUrl,
				)
			) {
				folder.thumbnailUrl = folder.pages[0]?.imageUrl;
				if (!folder.thumbnailUrl) delete folder.thumbnailUrl;
			}
		}
	}

	if (changed && !dryRun) {
		fs.writeFileSync(full, JSON.stringify(data, null, "\t") + "\n");
		touched.push(slug);
	} else if (changed) {
		touched.push(slug);
	}
}

console.log(
	`\n${scanned} page(s) scanned; ${removed} blank page(s) ` +
		`${dryRun ? "would be removed" : "removed"} from ${touched.length} folder(s)` +
		(touched.length ? `: ${touched.join(", ")}` : "") +
		".",
);
if (removed > 0 && !dryRun) {
	console.log("Run scripts/prune-screenshots.mjs to drop the now-unreferenced files.");
}
