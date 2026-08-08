#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Move folder page images from git into Vercel Blob.
//
// Committing screenshots works, but the scrape workflow force-adds them on
// every run, so history grows by roughly the weight of one full leaflet set per
// week (~20 MB) and never shrinks. Blob storage moves that out of git; the app
// needs no change, because next.config.ts already allows remote images and the
// viewer renders them `unoptimized`.
//
// The scraper writes new captures straight to Blob once BLOB_READ_WRITE_TOKEN
// is set (see src/scrapers/pageStorage.ts). This script is the one-off that
// carries across everything already on disk.
//
// Prerequisites:
//   1. Create a Blob store in the Vercel dashboard (Storage -> Blob).
//   2. Export BLOB_READ_WRITE_TOKEN locally.
//   3. Add the same value as a GitHub Actions secret so the weekly scrape
//      uploads instead of committing.
//
// Then:
//   node scripts/migrate-images-to-blob.mjs --dry-run   # report only
//   node scripts/migrate-images-to-blob.mjs             # upload + rewrite JSON
//
// Idempotent: filenames carry the ISO week, uploads overwrite the same key, and
// URLs already absolute are skipped. Safe to re-run after a partial failure.
//
// This script never deletes local files. Dropping public/screenshots from git
// is a separate, deliberate step once the uploaded URLs are confirmed live:
//   git rm -r --cached public/screenshots
//   echo "/public/screenshots" >> .gitignore
// and remove `public/screenshots` from the `git add` line in
// .github/workflows/scrape-folders.yml.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const foldersDir = path.join(root, "data", "folders");
const dryRun = process.argv.includes("--dry-run");

if (!process.env.BLOB_READ_WRITE_TOKEN && !dryRun) {
	console.error(
		"BLOB_READ_WRITE_TOKEN is not set.\n" +
			"Create a Blob store in the Vercel dashboard, then export the token.\n" +
			"Run with --dry-run to see what would be uploaded without one.",
	);
	process.exit(1);
}

/** Every site-relative image URL referenced by folder data, with its file. */
function referenced() {
	const out = new Map(); // url -> absolute path
	for (const file of fs.readdirSync(foldersDir).filter((f) => f.endsWith(".json"))) {
		let data;
		try {
			data = JSON.parse(fs.readFileSync(path.join(foldersDir, file), "utf-8"));
		} catch {
			continue;
		}
		for (const folder of data.folders ?? []) {
			const urls = [
				folder.thumbnailUrl,
				...(folder.pages ?? []).flatMap((p) => [p.imageUrl, p.thumbnailUrl]),
			];
			for (const url of urls) {
				// Already absolute means already uploaded on an earlier run.
				if (!url || !url.startsWith("/")) continue;
				const onDisk = path.join(publicDir, url.replace(/^\//, ""));
				if (fs.existsSync(onDisk)) out.set(url, onDisk);
			}
		}
	}
	return out;
}

/** Rewrite every occurrence of the migrated URLs across folder data. */
function applyUrls(mapping) {
	let touched = 0;
	for (const file of fs.readdirSync(foldersDir).filter((f) => f.endsWith(".json"))) {
		const full = path.join(foldersDir, file);
		const before = fs.readFileSync(full, "utf-8");
		let after = before;
		for (const [from, to] of mapping) after = after.split(`"${from}"`).join(`"${to}"`);
		if (after !== before) {
			fs.writeFileSync(full, after);
			touched++;
		}
	}
	return touched;
}

const files = referenced();
const totalBytes = [...files.values()].reduce((s, f) => s + fs.statSync(f).size, 0);
const mb = (b) => (b / 1024 / 1024).toFixed(1);

console.log(`${files.size} referenced image(s), ${mb(totalBytes)} MB.`);

if (dryRun) {
	console.log("Dry run: nothing uploaded. Re-run without --dry-run to migrate.");
	process.exit(0);
}

const { put } = await import("@vercel/blob");
const mapping = new Map();
let done = 0;
let failed = 0;

for (const [url, file] of files) {
	const name = path.basename(file);
	try {
		const result = await put(`screenshots/${name}`, fs.readFileSync(file), {
			access: "public",
			contentType: name.endsWith(".jpg") ? "image/jpeg" : "image/webp",
			addRandomSuffix: false,
			allowOverwrite: true,
			cacheControlMaxAge: 31_536_000,
		});
		mapping.set(url, result.url);
		if (++done % 25 === 0) console.log(`  ${done}/${files.size}`);
	} catch (err) {
		// Keep going: a partial migration still leaves the site working, because
		// anything not rewritten still points at the committed local file.
		console.warn(`  failed: ${name} (${err})`);
		failed++;
	}
}

const touched = applyUrls(mapping);
console.log(
	`\nUploaded ${done}/${files.size}${failed ? `, ${failed} failed` : ""}; ` +
		`rewrote ${touched} folder JSON file(s).`,
);
if (failed > 0) {
	console.log("Re-run to retry the failures before removing images from git.");
	process.exit(1);
}
console.log(
	"Verify the site renders, then drop public/screenshots from git (see header).",
);
