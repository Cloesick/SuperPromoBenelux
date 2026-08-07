#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Generate thumbnail-strip images for folder pages scraped before thumbnails
// existed, and record them in the folder JSON.
//
// FolderViewer draws one strip entry per page in a 64x88 box. next/image runs
// with `images.unoptimized: true`, so without a dedicated small file every
// entry downloads the full-size page: 26 MB to render IKEA's 60 thumbnails.
//
// Writes `<name>-thumb.webp` beside each page image and sets
// `pages[].thumbnailUrl`. Matches BaseScraper.THUMB_IMAGE_WIDTH / QUALITY so
// backfilled folders are indistinguishable from newly scraped ones.
//
// Idempotent: existing thumbnails are reused, and only site-relative page URLs
// are touched — absolute URLs are already in blob storage and are left alone.
//
//   node scripts/backfill-thumbnails.mjs [--dry-run]
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Kept in sync with BaseScraper.THUMB_IMAGE_WIDTH / THUMB_IMAGE_QUALITY.
const THUMB_IMAGE_WIDTH = 160;
const THUMB_IMAGE_QUALITY = 65;

const root = process.cwd();
const publicDir = path.join(root, "public");
const foldersDir = path.join(root, "data", "folders");
const dryRun = process.argv.includes("--dry-run");

/** `/screenshots/foo.webp` -> `/screenshots/foo-thumb.webp` */
function thumbUrlFor(url) {
	const ext = path.extname(url);
	return `${url.slice(0, -ext.length || undefined)}-thumb.webp`;
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

async function main() {
	if (!fs.existsSync(foldersDir)) {
		console.log("No data/folders directory.");
		return;
	}

	let generated = 0;
	let reused = 0;
	let skipped = 0;
	let failed = 0;
	let filesChanged = 0;
	let fullBytes = 0;
	let thumbBytes = 0;

	for (const file of fs.readdirSync(foldersDir).filter((f) => f.endsWith(".json"))) {
		const jsonPath = path.join(foldersDir, file);
		let data;
		try {
			data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
		} catch {
			console.warn(`  invalid JSON, skipped: ${file}`);
			failed++;
			continue;
		}

		let dirty = false;

		for (const folder of data.folders ?? []) {
			for (const page of folder.pages ?? []) {
				const url = page.imageUrl;
				// Absolute URLs live in blob storage; nothing local to derive from.
				if (!url || !url.startsWith("/")) {
					skipped++;
					continue;
				}

				const sourcePath = path.join(publicDir, url.replace(/^\//, ""));
				if (!fs.existsSync(sourcePath)) {
					skipped++;
					continue;
				}

				const thumbUrl = thumbUrlFor(url);
				const thumbPath = path.join(publicDir, thumbUrl.replace(/^\//, ""));

				if (fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 0) {
					reused++;
				} else if (dryRun) {
					generated++;
					continue;
				} else {
					try {
						const raw = fs.readFileSync(sourcePath);
						const out = await sharp(raw, { limitInputPixels: false })
							.resize({ width: THUMB_IMAGE_WIDTH, withoutEnlargement: true })
							.webp({ quality: THUMB_IMAGE_QUALITY })
							.toBuffer();
						fs.writeFileSync(thumbPath, out);
						generated++;
					} catch (err) {
						// No thumbnail just means the viewer falls back to the full page.
						console.warn(`  failed: ${path.basename(sourcePath)} (${err})`);
						failed++;
						continue;
					}
				}

				fullBytes += fs.statSync(sourcePath).size;
				thumbBytes += fs.statSync(thumbPath).size;

				if (page.thumbnailUrl !== thumbUrl) {
					page.thumbnailUrl = thumbUrl;
					dirty = true;
				}
			}
		}

		if (dirty && !dryRun) {
			fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`);
			filesChanged++;
		} else if (dirty) {
			filesChanged++;
		}
	}

	const verb = dryRun ? "would generate" : "generated";
	console.log(
		`\nThumbnails: ${verb} ${generated}, reused ${reused}, skipped ${skipped}` +
			`${failed ? `, failed ${failed}` : ""}.`,
	);
	console.log(
		`${filesChanged} folder file(s) ${dryRun ? "would be" : ""} updated with thumbnailUrl.`,
	);
	if (fullBytes > 0) {
		const pct = Math.round((1 - thumbBytes / fullBytes) * 100);
		console.log(
			`Thumbnail strip weight: ${mb(fullBytes)} MB -> ${mb(thumbBytes)} MB (${pct}% lighter).`,
		);
	}
}

await main();
