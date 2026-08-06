#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Re-optimise folder page images that were captured before the scraper started
// doing it itself.
//
// base.ts optimizePageImage() resizes every new capture to 1800px wide at WebP
// q78, but that only applies going forward. Folders scraped earlier still point
// at raw deviceScaleFactor-3 captures — 316 of the 399 referenced images, ~287
// MB, at up to 2.6 MB for a single page rendered with `priority`.
//
// next.config.ts sets `images.unoptimized: true`, so Next resizes nothing:
// whatever is on disk is exactly what a visitor downloads. This script brings
// the existing files in line with what the scraper now produces.
//
// The full-resolution original is copied to data/ocr-src/ first (gitignored,
// never served) when it is not already there, because src/scrapers/ocr.ts
// prefers that directory — resizing in place without preserving it would cost
// recognition accuracy on every already-scraped retailer.
//
// Idempotent: re-running skips anything already at or under the target width.
//
//   node scripts/optimize-page-images.mjs [--dry-run]
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Kept in sync with BaseScraper.PAGE_IMAGE_WIDTH / PAGE_IMAGE_QUALITY.
const PAGE_IMAGE_WIDTH = 1800;
const PAGE_IMAGE_QUALITY = 78;

const root = process.cwd();
const publicDir = path.join(root, "public");
const ocrSrcDir = path.join(root, "data", "ocr-src");
const dryRun = process.argv.includes("--dry-run");

/** Every site-relative page image referenced by folder data, deduplicated. */
function referencedImages() {
	const foldersDir = path.join(root, "data", "folders");
	const out = new Set();
	if (!fs.existsSync(foldersDir)) return [];

	for (const file of fs.readdirSync(foldersDir).filter((f) => f.endsWith(".json"))) {
		let data;
		try {
			data = JSON.parse(fs.readFileSync(path.join(foldersDir, file), "utf-8"));
		} catch {
			continue;
		}
		for (const folder of data.folders ?? []) {
			const urls = [
				...(folder.pages ?? []).map((p) => p.imageUrl),
				folder.thumbnailUrl,
			];
			for (const url of urls) {
				// Absolute URLs are already in blob storage; nothing local to shrink.
				if (!url || !url.startsWith("/")) continue;
				const onDisk = path.join(publicDir, url.replace(/^\//, ""));
				if (fs.existsSync(onDisk)) out.add(onDisk);
			}
		}
	}
	return [...out].sort();
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

async function main() {
	const files = referencedImages();
	if (files.length === 0) {
		console.log("No referenced page images found on disk.");
		return;
	}

	let before = 0;
	let after = 0;
	let resized = 0;
	let skipped = 0;
	let preserved = 0;
	let failed = 0;

	for (const file of files) {
		const size = fs.statSync(file).size;
		before += size;

		// Read the bytes up front rather than letting sharp open the path: on
		// Windows the read handle is still open when the resized result is written
		// back to the same file, and the write fails with a bare UNKNOWN errno.
		let raw;
		let meta;
		try {
			raw = fs.readFileSync(file);
			meta = await sharp(raw, { limitInputPixels: false }).metadata();
		} catch (err) {
			console.warn(`  unreadable, left alone: ${path.basename(file)} (${err})`);
			after += size;
			failed++;
			continue;
		}

		if (!meta.width || meta.width <= PAGE_IMAGE_WIDTH) {
			after += size;
			skipped++;
			continue;
		}

		if (dryRun) {
			after += size;
			resized++;
			continue;
		}

		try {
			// Preserve the full-resolution capture for OCR before overwriting it.
			const preservedPath = path.join(ocrSrcDir, path.basename(file));
			if (!fs.existsSync(preservedPath)) {
				fs.mkdirSync(ocrSrcDir, { recursive: true });
				fs.writeFileSync(preservedPath, raw);
				preserved++;
			}

			const out = await sharp(raw, { limitInputPixels: false })
				.resize({ width: PAGE_IMAGE_WIDTH, withoutEnlargement: true })
				.webp({ quality: PAGE_IMAGE_QUALITY })
				.toBuffer();

			// Never make a page heavier than it already was.
			if (out.length > 0 && out.length < size) {
				fs.writeFileSync(file, out);
				after += out.length;
				resized++;
			} else {
				after += size;
				skipped++;
			}
		} catch (err) {
			console.warn(`  failed, left alone: ${path.basename(file)} (${err})`);
			after += size;
			failed++;
		}
	}

	const verb = dryRun ? "would resize" : "resized";
	console.log(
		`\n${files.length} referenced page image(s): ${verb} ${resized}, ` +
			`skipped ${skipped}${failed ? `, failed ${failed}` : ""}.`,
	);
	if (preserved > 0) {
		console.log(`Preserved ${preserved} full-resolution original(s) to data/ocr-src/.`);
	}
	if (dryRun) {
		console.log(`Current total: ${mb(before)} MB (run without --dry-run to shrink).`);
	} else {
		const saved = before - after;
		const pct = before > 0 ? Math.round((saved / before) * 100) : 0;
		console.log(`${mb(before)} MB -> ${mb(after)} MB (saved ${mb(saved)} MB, ${pct}%).`);
	}
}

await main();
