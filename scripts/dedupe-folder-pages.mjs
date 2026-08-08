#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Collapse near-duplicate pages in already-scraped folder data.
//
// captureDedupedPage() compared captures byte-for-byte, which almost never
// matched: viewers re-render the same spread with sub-pixel differences, and
// pages with lazy-loaded carousels differ on every capture. The result was
// folders claiming 60 pages that held a handful of distinct images:
//
//   ikea          60 captures ->  3 distinct
//   ici-paris-xl  60 captures -> 14 distinct
//   rossmann      60 captures ->  4 distinct
//   douglas       60 captures ->  1 distinct
//   colruyt       20 captures -> 10 distinct (every Issuu spread twice)
//
// Serving those is worse than useless: the viewer promises "Pagina 1 van 60",
// the visitor pages through the same image, and Google sees 60 near-identical
// URLs per retailer. base.ts now fingerprints new captures the same way; this
// repairs what is already on disk.
//
// Uses the same 64-bit difference hash and Hamming threshold as
// BaseScraper.perceptualHash / DUPLICATE_HAMMING_THRESHOLD.
//
//   node scripts/dedupe-folder-pages.mjs [--dry-run]
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Kept in sync with BaseScraper.DUPLICATE_HAMMING_THRESHOLD.
const DUPLICATE_HAMMING_THRESHOLD = 4;

const root = process.cwd();
const publicDir = path.join(root, "public");
const foldersDir = path.join(root, "data", "folders");
const dryRun = process.argv.includes("--dry-run");

async function perceptualHash(file) {
	try {
		const px = await sharp(fs.readFileSync(file), { limitInputPixels: false })
			.resize(9, 8, { fit: "fill" })
			.greyscale()
			.raw()
			.toBuffer();
		let bits = 0n;
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				const i = y * 9 + x;
				bits = (bits << 1n) | (px[i] > px[i + 1] ? 1n : 0n);
			}
		}
		return bits;
	} catch {
		return null;
	}
}

function hamming(a, b) {
	let diff = a ^ b;
	let count = 0;
	while (diff > 0n) {
		count += Number(diff & 1n);
		diff >>= 1n;
	}
	return count;
}

async function main() {
	if (!fs.existsSync(foldersDir)) {
		console.log("No data/folders directory.");
		return;
	}

	let totalBefore = 0;
	let totalAfter = 0;
	const changed = [];

	for (const file of fs.readdirSync(foldersDir).filter((f) => f.endsWith(".json"))) {
		const jsonPath = path.join(foldersDir, file);
		let data;
		try {
			data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
		} catch {
			continue;
		}

		let dirty = false;

		for (const folder of data.folders ?? []) {
			const pages = folder.pages ?? [];
			if (pages.length === 0) continue;

			const kept = [];
			const seen = [];

			for (const page of pages) {
				const url = page.imageUrl;
				// Absolute URLs are blob-hosted; nothing local to fingerprint, so
				// keep them rather than guess.
				if (!url || !url.startsWith("/")) {
					kept.push(page);
					continue;
				}
				const onDisk = path.join(publicDir, url.replace(/^\//, ""));
				if (!fs.existsSync(onDisk)) {
					kept.push(page);
					continue;
				}

				const fp = await perceptualHash(onDisk);
				if (fp === null) {
					kept.push(page);
					continue;
				}
				if (seen.some((s) => hamming(s, fp) <= DUPLICATE_HAMMING_THRESHOLD)) {
					continue;
				}
				seen.push(fp);
				kept.push(page);
			}

			totalBefore += pages.length;
			totalAfter += kept.length;

			if (kept.length !== pages.length) {
				kept.forEach((p, i) => {
					p.pageNumber = i + 1;
				});
				folder.pages = kept;
				folder.pageCount = kept.length;
				dirty = true;
				changed.push([file.replace(".json", ""), pages.length, kept.length]);
			}
		}

		if (dirty && !dryRun) {
			fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`);
		}
	}

	changed.sort((a, b) => b[1] - b[2] - (a[1] - a[2]));
	for (const [slug, before, after] of changed) {
		console.log(`  ${slug.padEnd(16)} ${String(before).padStart(3)} -> ${after}`);
	}
	console.log(
		`\n${dryRun ? "Would collapse" : "Collapsed"} ${totalBefore} page(s) to ` +
			`${totalAfter} across ${changed.length} folder(s).`,
	);
	if (!dryRun) {
		console.log(
			"Page image files are left on disk; run the orphan prune to remove " +
				"the ones no longer referenced.",
		);
	}
}

await main();
