#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Give PDF-only retailers real page images.
//
// Seventeen retailers — the Publitas-harvested ones plus a few others — have a
// folder whose only renderable source is a PDF. The viewer framed it, so the
// visitor got the browser's PDF plugin: no thumbnails, nothing for image
// search, and frequently a grey box on mobile. Every other retailer serves
// page images.
//
// This renders those PDFs to the same page images, writes them to
// public/screenshots, and points the folder JSON at them. The scraper does
// this for new folders too (see BaseScraper.takeScreenshots); this backfills
// what has already been harvested.
//
//   npx tsx scripts/backfill-pdf-pages.mts [--dry-run] [--only <slug>] [--max N]
//
// Safe to re-run: a retailer that already has pages is skipped, and a render
// that produces nothing leaves the folder exactly as it was, still framing its
// PDF. Nothing is removed on failure.
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import sharp from "sharp";
import puppeteer from "rebrowser-puppeteer";
import { renderPdfToImages, pdfOrigin } from "../src/scrapers/pdfRender";
import { storePageImage, isBlobConfigured } from "../src/scrapers/pageStorage";
import { isFolderExpired, isNonLeafletPdf } from "../src/lib/folderRenderability";


const root = process.cwd();
const foldersDir = path.join(root, "data", "folders");
const shotsDir = path.join(root, "public", "screenshots");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
/** Comma-separated slugs, e.g. --only alvo,welkoop */
const only = args.includes("--only")
	? new Set((args[args.indexOf("--only") + 1] ?? "").split(",").filter(Boolean))
	: null;
/**
 * Re-render retailers that already have pages.
 *
 * Needed when an earlier run truncated a leaflet: alvo's folder is 76 pages
 * and a --max of 30 stored the first 30, which then looks like "already done".
 */
const force = args.includes("--force");
// 80 covers the longest leaflet seen (alvo, 76 pages). A cap that silently
// truncates defeats the point of rendering the PDF at all.
const maxPages = args.includes("--max") ? Number(args[args.indexOf("--max") + 1]) : 80;

/** Matches BaseScraper: 1800px wide, WebP q78, 160px thumbnails at q65. */
const PAGE_QUALITY = 78;
const THUMB_WIDTH = 160;
const THUMB_QUALITY = 65;
/** Matches BaseScraper.BLANK_STDDEV_THRESHOLD. */
const BLANK_STDDEV = 3;

function isoWeekTag(d = new Date()): string {
	const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
	const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	// The ISO week-year, not the calendar year: 29 Dec 2025 is 2026-w1, and
	// pairing it with 2025 collided with the following January's filenames.
	return `${t.getUTCFullYear()}-w${week}`;
}

async function meanStdev(buf: Buffer): Promise<number> {
	const { channels } = await sharp(buf, { limitInputPixels: false }).stats();
	return channels.reduce((s, c) => s + c.stdev, 0) / channels.length;
}

interface Candidate {
	slug: string;
	pdfUrl: string;
	/**
	 * Position in data.folders. 0 is the current folder; higher is an upcoming
	 * one ("volgende week"), which used to be listed with no pages at all until
	 * it became current, although ~20% of search impressions ask for it.
	 */
	folderIndex: number;
}

const candidates: Candidate[] = [];
const skippedExpired: string[] = [];
for (const file of fs.readdirSync(foldersDir).filter((f) => f.endsWith(".json"))) {
	const slug = file.replace(/\.json$/, "");
	if (only && !only.has(slug)) continue;
	const data = JSON.parse(fs.readFileSync(path.join(foldersDir, file), "utf-8"));
	for (const [folderIndex, folder] of ((data.folders ?? []) as Record<string, any>[]).entries()) {
	if (!force && (folder.pages ?? []).length > 0) continue;
	// Deliberately NOT hasUsablePdf: that asks "can an iframe display this?",
	// which is false for the attachment-disposition PDFs albert-heijn, gamma,
	// kruidvat, treac and lidl sign their links with. Content-Disposition
	// governs how a browser *presents* a response, not whether it can be read —
	// fetching those bytes and rendering them ourselves works fine, and it is
	// the only way those retailers get page images at all.
	if (!folder.pdfUrl) continue;
	// ...but a product spec sheet is not a leaflet. Coolblue pointed at an EU
	// energy label for a single appliance, which would have rendered as a
	// one-page "folder" showing a washing machine's efficiency rating.
	if (isNonLeafletPdf(folder.pdfUrl)) continue;
	// An expired folder is not worth rendering, and its signed PDF link has
	// usually expired with it. A harvest that skips a retailer (nothing current
	// published) leaves last week's file in place, and rendering that got a
	// 403 and failed the whole run, blocking every other retailer's commit.
	if (isFolderExpired(folder.validUntil)) {
		skippedExpired.push(slug);
		continue;
	}
	candidates.push({ slug, pdfUrl: folder.pdfUrl, folderIndex });
	}
}
if (skippedExpired.length > 0) {
	console.log(`Skipping ${skippedExpired.length} expired folder(s): ${skippedExpired.join(", ")}`);
}

console.log(
	`${candidates.length} retailer(s) with a renderable PDF` +
		(force ? " (--force: re-rendering even where pages exist)" : " and no pages") +
		":",
);
for (const c of candidates) console.log(`  ${c.slug}${c.folderIndex > 0 ? " (upcoming)" : ""}`);
if (dryRun || candidates.length === 0) {
	console.log(dryRun ? "\nDry run — nothing rendered." : "\nNothing to do.");
	process.exit(0);
}

// public/screenshots is gitignored (.gitignore:66) and holds nothing tracked, so
// git never creates it and a fresh actions/checkout has no such directory. Every
// write below then failed with ENOENT — which is why this script rendered
// perfectly on a developer machine, where the directory survives from an earlier
// run, and never once produced a page in CI.
fs.mkdirSync(shotsDir, { recursive: true });

const browser = await puppeteer.launch({
	headless: true,
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
	args: ["--no-sandbox", "--disable-dev-shm-usage"],
	// A backstop, not the fix: pdfRender renders one page per evaluate, so no
	// single protocol call carries a whole leaflet any more. This only has to
	// cover one unusually heavy page.
	protocolTimeout: 600_000,
});

const week = isoWeekTag();
let totalPages = 0;
const succeeded: string[] = [];
async function readableCrossOrigin(url: string): Promise<boolean> {
	try {
		const r = await fetch(url, { method: "HEAD", headers: { Origin: "https://superpromobelgie.com" } });
		return r.headers.get("access-control-allow-origin") === "*";
	} catch {
		return false;
	}
}

const failed: string[] = [];
/** Pages recorded as a local path while blob storage was configured. */
let fellBackToLocal = 0;

/** Upcoming folders that failed: reported, but never block the commit. */
const failedUpcoming: string[] = [];

for (const { slug, pdfUrl, folderIndex } of candidates) {
	// Only the current folder's failure should stop the harvest's commit;
	// losing next week's pages keeps last state, it doesn't break this week.
	const fail = () => (folderIndex === 0 ? failed : failedUpcoming).push(slug);
	const page = await browser.newPage();
	try {
		// Fetch happens in the page, so land on the PDF's own origin first —
		// otherwise a cross-origin read is blocked and nothing renders.
		// Unless the host lets any origin read it: then stay on a blank page.
		// WePublish's origin sends a CSP without blob:, which blocks the
		// renderer's own module import, but it also sends
		// Access-Control-Allow-Origin: *, so a blank page reads it fine.
		const origin = (await readableCrossOrigin(pdfUrl)) ? null : pdfOrigin(pdfUrl);
		if (origin) {
			await page
				.goto(`${origin}/robots.txt`, { waitUntil: "domcontentloaded", timeout: 30000 })
				.catch(() => {});
		}

		process.stdout.write(`${slug}: rendering… `);
		const { pages, totalPages: docPages } = await renderPdfToImages(
			page,
			pdfUrl,
			maxPages,
			(m) => console.log(m),
		);

		if (pages.length === 0) {
			console.log("no pages produced, left framing its PDF");
			fail();
			continue;
		}

		const written: {
			pageNumber: number;
			imageUrl: string;
			thumbnailUrl?: string;
			deals: unknown[];
		}[] = [];

		for (const raw of pages) {
			// Same blank rejection the scraper applies: a page that renders flat is
			// not content, and recording it would put an empty frame in the viewer.
			if ((await meanStdev(raw)) < BLANK_STDDEV) continue;

			const n = written.length + 1;
			// An upcoming folder rendered the same week needs its own names, or
			// it would overwrite the current folder's page images.
			const base = `${slug}-${week}${folderIndex > 0 ? `-f${folderIndex}` : ""}-pdfimg-p${n}`;
			const img = await sharp(raw, { limitInputPixels: false })
				.webp({ quality: PAGE_QUALITY })
				.toBuffer();
			const thumb = await sharp(raw, { limitInputPixels: false })
				.resize({ width: THUMB_WIDTH, withoutEnlargement: true })
				.webp({ quality: THUMB_QUALITY })
				.toBuffer();

			// Local copies stay for OCR and offline development; the URL recorded
			// is whatever storePageImage returns. This used to hardcode
			// /screenshots/… — which was fine while images were committed, and
			// silently wrong the moment they moved to blob storage and
			// public/screenshots was gitignored: every page this script produced
			// would 404 in production while looking perfect locally.
			fs.writeFileSync(path.join(shotsDir, `${base}.webp`), img);
			fs.writeFileSync(path.join(shotsDir, `${base}-thumb.webp`), thumb);
			const storedPage = await storePageImage(`${base}.webp`, img, (m) => console.log(m));
			const storedThumb = await storePageImage(`${base}-thumb.webp`, thumb, (m) => console.log(m));
			// A local path recorded while blob storage is configured is a guaranteed
			// 404 in production: public/screenshots is gitignored, so the bytes never
			// leave the runner. storePageImage deliberately never throws, which makes
			// this the only place the fallback is visible.
			if (isBlobConfigured() && (!storedPage.uploaded || !storedThumb.uploaded))
				fellBackToLocal++;
			written.push({
				pageNumber: n,
				imageUrl: storedPage.url,
				thumbnailUrl: storedThumb.url,
				deals: [],
			});
		}

		if (written.length === 0) {
			console.log("every rendered page was blank, left framing its PDF");
			fail();
			continue;
		}

		const jsonPath = path.join(foldersDir, `${slug}.json`);
		const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
		const folder = data.folders[folderIndex];
		folder.pages = written;
		folder.pageCount = written.length;
		folder.thumbnailUrl = written[0].imageUrl;
		fs.writeFileSync(jsonPath, JSON.stringify(data, null, "\t") + "\n");

		totalPages += written.length;
		succeeded.push(slug);
		console.log(`${written.length} page(s) of ${docPages}`);
	} catch (err) {
		console.log(`failed: ${err}`);
		fail();
	} finally {
		await page.close().catch(() => {});
	}
}

await browser.close();

console.log(
	`\n${succeeded.length} retailer(s) gained ${totalPages} page image(s)` +
		(succeeded.length ? `: ${succeeded.join(", ")}` : "") +
		".",
);
if (failed.length) {
	console.log(
		`${failed.length} left with no page images: ${failed.join(", ")}.`,
	);
}
if (failedUpcoming.length) {
	console.log(`Upcoming folders not rendered (not blocking): ${failedUpcoming.join(", ")}.`);
}

if (fellBackToLocal > 0) {
	console.log(
		`${fellBackToLocal} page(s) fell back to a local path despite blob storage ` +
			`being configured. Those URLs 404 in production.`,
	);
}

// Exiting non-zero is the point of this block.
//
// The old message here read "These are unchanged, not broken", and that was
// true when this script only ever added pages to folders that had none. It
// stopped being true once it ran inside the harvest: the harvest writes
// pages: [] first, because Publitas page images are signed and lazy-loaded and
// it cannot fetch them, and depends on this render to put them back. A failure
// here therefore leaves a folder claiming to be current with nothing to show.
//
// That is what happened. Every harvest commit from 2026-08-20 to 2026-09-07
// wrote pages=0 for lidl, and the run stayed green and committed anyway, so
// nineteen retailers reached production as empty folders without one red
// build. Failing here stops the commit step, which keeps last week's complete
// folder instead of publishing this week's empty one.
if (!dryRun && (failed.length > 0 || fellBackToLocal > 0)) process.exit(1);
