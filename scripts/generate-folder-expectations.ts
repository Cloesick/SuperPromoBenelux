#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Write the per-retailer baseline that cypress/e2e/folder-expectations.cy.ts
// checks every folder page against.
//
// Why a committed baseline: the leaflets change every week, so "aldi has
// exactly 34 pages" fails every Monday for no reason, while "aldi has at least
// one page" passes as a scraper quietly collapses from 34 pages to 1. Neither
// catches the failure that matters — a retailer degrading unnoticed.
//
// So each retailer gets a *floor*, set well under what it currently delivers.
// Weekly variation passes; a collapse fails. The floors are committed, so a
// regression has to be argued for in a diff rather than slipping through.
//
// This is TypeScript, run with tsx, for one reason: it imports the app's own
// isFolderIndexable/hasUsableEmbed rather than re-deriving them. An earlier
// version reimplemented "is this embed framable?" in a few lines of regex and
// promptly disagreed with the app about Gamma — whose embed is a bare viewer
// homepage the app rejects — producing a baseline that failed against correct
// behaviour. A test fixture that duplicates the logic it checks tests nothing.
//
//   npx tsx scripts/generate-folder-expectations.ts           # rewrite
//   npx tsx scripts/generate-folder-expectations.ts --check   # fail if stale
//
// Regenerate deliberately — after confirming a change is an improvement, not
// as a reflex when the suite goes red.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import {
	hasUsableEmbed,
	hasUsablePdf,
	isFolderExpired,
} from "../src/lib/folderRenderability";

/**
 * Headroom under the current page count.
 *
 * 0.6 tolerates a leaflet that is genuinely shorter some weeks — Colruyt runs
 * 10 pages normally and fewer over a holiday — while still failing on the
 * collapses this project actually hit: 34 pages to 1 when a viewer changed its
 * markup, 18 to 2 when spread detection truncated at the first repeat.
 */
const FLOOR_RATIO = 0.6;

/** Below this, a "folder" is a cover image, not a leaflet worth a floor. */
const MIN_MEANINGFUL_PAGES = 3;

type Mode = "pages" | "embed" | "pdf" | "empty";

interface FolderShape {
	pages?: unknown[];
	embedUrl?: string | null;
	pdfUrl?: string | null;
	thumbnailUrl?: string | null;
	validUntil?: string | null;
}

const root = process.cwd();
const foldersDir = path.join(root, "data", "folders");
const outPath = path.join(root, "cypress", "fixtures", "folder-expectations.json");
const checkOnly = process.argv.includes("--check");

/**
 * How this retailer's folder reaches the visitor.
 *
 * Mirrors the order FolderViewer resolves in — captured pages, then a framable
 * embed, then an inline PDF — using the app's own predicates so the baseline
 * and the app cannot disagree about what "framable" means.
 */
function renderMode(folder: FolderShape | null, slug: string): Mode {
	if (!folder) return "empty";
	if ((folder.pages ?? []).length > 0) return "pages";
	if (hasUsableEmbed(folder.embedUrl, slug)) return "embed";
	if (hasUsablePdf(folder.pdfUrl)) return "pdf";
	return "empty";
}

const slugs = fs
	.readdirSync(foldersDir)
	.filter((f) => f.endsWith(".json"))
	.map((f) => f.replace(/\.json$/, ""))
	.sort();

const retailers: Record<
	string,
	{ mode: Mode; minPages: number | null; observedPages: number; expired: boolean }
> = {};

for (const slug of slugs) {
	const data = JSON.parse(fs.readFileSync(path.join(foldersDir, `${slug}.json`), "utf-8"));
	const folder: FolderShape | null = (data.folders ?? [])[0] ?? null;
	const pages = (folder?.pages ?? []).length;
	retailers[slug] = {
		mode: renderMode(folder, slug),
		// null means "no floor asserted" — a one-page cover has nothing to hold.
		minPages:
			pages >= MIN_MEANINGFUL_PAGES ? Math.max(1, Math.floor(pages * FLOOR_RATIO)) : null,
		observedPages: pages,
		// Recorded rather than asserted: a folder expiring is normal, and the
		// spec only requires that an expired one says so instead of passing last
		// month's prices off as this week's.
		expired: isFolderExpired(folder?.validUntil),
	};
}

const serialized =
	JSON.stringify(
		{
			generatedFrom: `${slugs.length} retailer(s) in data/folders`,
			floorRatio: FLOOR_RATIO,
			retailers,
		},
		null,
		"\t",
	) + "\n";

if (checkOnly) {
	const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf-8") : "";
	if (existing !== serialized) {
		console.error(
			"cypress/fixtures/folder-expectations.json is out of date.\n" +
				"Run: npx tsx scripts/generate-folder-expectations.ts\n" +
				"Do this only after confirming the change is an improvement.",
		);
		process.exit(1);
	}
	console.log("Baseline matches current folder data.");
	process.exit(0);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, serialized);

const byMode = Object.values(retailers).reduce<Record<string, number>>((acc, r) => {
	acc[r.mode] = (acc[r.mode] ?? 0) + 1;
	return acc;
}, {});
console.log(`Wrote ${path.relative(root, outPath)}`);
console.log(`${slugs.length} retailer(s):`, byMode);
console.log(
	`${Object.values(retailers).filter((r) => r.minPages !== null).length} carry a page floor; ` +
		`${Object.values(retailers).filter((r) => r.expired).length} expired.`,
);
