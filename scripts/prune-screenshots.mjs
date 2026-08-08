#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Delete screenshots that no folder JSON references.
//
// The scraper captures up to MAX_SCREENSHOT_PAGES per retailer and writes every
// one to disk, but only the pages that survive blank-detection and duplicate
// collapsing are recorded in the folder data. The rest accumulate: public/
// reached 836 files while the site referenced a fraction of them.
//
// Referenced means "named by pages[].imageUrl, pages[].thumbnailUrl, or a
// folder thumbnailUrl", so this stays correct as those fields change. Absolute
// (blob) URLs simply reference nothing local, which is the intended behaviour
// once the migration lands.
//
// Orphans are not simply deleted. A page image dropped by duplicate collapsing
// still carries OCR value — the price history is built from these — so any
// orphan not already held in data/ocr-src is moved there rather than removed.
// That directory is gitignored and never served, so it costs disk only.
// Thumbnails are the exception: they are downscaled derivatives with no OCR
// value and are regenerated from the page image, so they are deleted outright.
//
//   node scripts/prune-screenshots.mjs [--dry-run]
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const screenshotsDir = path.join(publicDir, "screenshots");
const ocrSrcDir = path.join(root, "data", "ocr-src");
const foldersDir = path.join(root, "data", "folders");
const dryRun = process.argv.includes("--dry-run");

function referencedFilenames() {
	const keep = new Set();
	if (!fs.existsSync(foldersDir)) return keep;

	const add = (url) => {
		if (!url || !url.startsWith("/screenshots/")) return;
		keep.add(path.basename(url));
	};

	for (const file of fs.readdirSync(foldersDir).filter((f) => f.endsWith(".json"))) {
		let data;
		try {
			data = JSON.parse(fs.readFileSync(path.join(foldersDir, file), "utf-8"));
		} catch {
			// An unreadable folder file must not cause its images to be deleted.
			throw new Error(`Refusing to prune: data/folders/${file} is not valid JSON`);
		}
		for (const folder of data.folders ?? []) {
			add(folder.thumbnailUrl);
			for (const page of folder.pages ?? []) {
				add(page.imageUrl);
				add(page.thumbnailUrl);
			}
		}
	}
	return keep;
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

function main() {
	if (!fs.existsSync(screenshotsDir)) {
		console.log("No public/screenshots directory.");
		return;
	}

	const keep = referencedFilenames();
	// A folder set that references nothing means the data is missing, not that
	// every image is garbage. Deleting the lot would be unrecoverable.
	if (keep.size === 0) {
		console.error(
			"Refusing to prune: no folder data references any screenshot. " +
				"Check data/folders/ before running this again.",
		);
		process.exitCode = 1;
		return;
	}

	const all = fs.readdirSync(screenshotsDir);
	const orphans = all.filter((f) => !keep.has(f));
	let freed = 0;
	let archived = 0;
	let deleted = 0;

	if (!dryRun && orphans.length > 0) {
		fs.mkdirSync(ocrSrcDir, { recursive: true });
	}

	for (const file of orphans) {
		const full = path.join(screenshotsDir, file);
		freed += fs.statSync(full).size;

		// Thumbnails are derivatives; the page image they came from is what OCR
		// reads, so there is nothing to preserve.
		if (/-thumb\.webp$/.test(file)) {
			if (!dryRun) fs.rmSync(full, { force: true });
			deleted++;
			continue;
		}

		const archivePath = path.join(ocrSrcDir, file);
		if (fs.existsSync(archivePath)) {
			// A full-resolution copy is already held; this one is redundant.
			if (!dryRun) fs.rmSync(full, { force: true });
			deleted++;
		} else {
			if (!dryRun) fs.renameSync(full, archivePath);
			archived++;
		}
	}

	console.log(
		`${all.length} file(s) on disk, ${keep.size} referenced, ` +
			`${orphans.length} orphaned.`,
	);
	console.log(
		`  ${archived} moved to data/ocr-src (kept for OCR), ${deleted} deleted.`,
	);
	console.log(
		`${dryRun ? "Would free" : "Freed"} ${mb(freed)} MB from public/.` +
			(dryRun ? " Run without --dry-run to apply." : ""),
	);
}

main();
