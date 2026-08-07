#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Fail the build when data references an asset that is not in the repository.
//
// This exists because of a real outage: commit 54ac8d8 replaced the retailer
// logos with WebP versions, but .gitignore had been corrupted to a literal "*"
// by a UTF-16LE append, so the new files were silently never added. public/ did
// not exist in the repository at all, and every logo on every page 404'd in
// production for months. Nothing caught it — the unit suite mocks next/image,
// so broken image URLs are invisible to it.
//
// Checks:
//   1. every `logo` in src/lib/retailers.ts resolves under public/
//   2. every site-relative `pages[].imageUrl` in data/folders/*.json resolves
//      under public/  (absolute URLs are blob-hosted and skipped)
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");
const failures = [];
const warnings = [];

// Folder page images are mid-migration to blob storage: they are not committed
// and are not yet uploaded, so in a fresh checkout every site-relative page URL
// is missing. That is a real production fault, but blocking every PR on it
// helps nobody, so it reports as a warning until the migration lands. Logos are
// committed and always hard-fail — that is the regression this script exists
// for. Remove this flag once page URLs are absolute.
const pageImagesAdvisory = process.env.ALLOW_MISSING_PAGE_IMAGES === "1";

function assertExists(relUrl, source, { advisory = false } = {}) {
	// Absolute URLs live in blob storage; nothing to verify on disk.
	if (!relUrl || !relUrl.startsWith("/")) return;
	const onDisk = path.join(publicDir, relUrl.replace(/^\//, ""));
	if (!fs.existsSync(onDisk)) {
		(advisory ? warnings : failures).push(`${source} -> ${relUrl}`);
		return;
	}
	// A zero-byte file exists but renders exactly like a 404. zooplus shipped a
	// single-page folder whose only page was empty, so the viewer drew "Pagina 1
	// van 1" around nothing. Always a hard failure: unlike a missing page image,
	// this is never an expected mid-migration state.
	if (fs.statSync(onDisk).size === 0) {
		failures.push(`${source} -> ${relUrl} (file is empty)`);
	}
}

// --- 1. retailer logos ------------------------------------------------------

const retailersSrc = fs.readFileSync(
	path.join(root, "src", "lib", "retailers.ts"),
	"utf-8",
);
const logoMatches = [...retailersSrc.matchAll(/logo:\s*"([^"]+)"/g)];
if (logoMatches.length === 0) {
	failures.push("src/lib/retailers.ts -> no logo entries found (parser broken?)");
}
for (const [, logo] of logoMatches) {
	assertExists(logo, "retailers.ts logo");
}

// --- 2. folder page images --------------------------------------------------

const foldersDir = path.join(root, "data", "folders");
let pageCount = 0;
if (fs.existsSync(foldersDir)) {
	for (const file of fs.readdirSync(foldersDir).filter((f) => f.endsWith(".json"))) {
		let data;
		try {
			data = JSON.parse(fs.readFileSync(path.join(foldersDir, file), "utf-8"));
		} catch {
			failures.push(`data/folders/${file} -> invalid JSON`);
			continue;
		}
		for (const folder of data.folders ?? []) {
			for (const page of folder.pages ?? []) {
				pageCount++;
				assertExists(
					page.imageUrl,
					`data/folders/${file} page ${page.pageNumber}`,
					{ advisory: pageImagesAdvisory },
				);
			}
			assertExists(folder.thumbnailUrl, `data/folders/${file} thumbnail`, {
				advisory: pageImagesAdvisory,
			});
		}
	}
}

// --- report -----------------------------------------------------------------

console.log(
	`Checked ${logoMatches.length} retailer logos and ${pageCount} folder page images.`,
);

if (warnings.length > 0) {
	console.warn(
		`\n${warnings.length} folder page image(s) not present locally ` +
			"(expected while page images migrate to blob storage).",
	);
	for (const w of warnings.slice(0, 5)) console.warn(`  ${w}`);
	if (warnings.length > 5) console.warn(`  ... and ${warnings.length - 5} more`);
}

if (failures.length > 0) {
	console.error(`\n${failures.length} referenced asset(s) missing from public/:\n`);
	for (const f of failures.slice(0, 40)) console.error(`  ${f}`);
	if (failures.length > 40) console.error(`  ... and ${failures.length - 40} more`);
	console.error(
		"\nThese render as broken images in production. Commit the assets, or " +
			"upload them to blob storage so the data references absolute URLs.",
	);
	process.exit(1);
}

console.log("All referenced assets are present.");
