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
import { isNonLeafletPdf } from "../src/lib/folderRenderability";


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
}

const candidates: Candidate[] = [];
for (const file of fs.readdirSync(foldersDir).filter((f) => f.endsWith(".json"))) {
	const slug = file.replace(/\.json$/, "");
	if (only && !only.has(slug)) continue;
	const data = JSON.parse(fs.readFileSync(path.join(foldersDir, file), "utf-8"));
	const folder = (data.folders ?? [])[0];
	if (!folder) continue;
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
	candidates.push({ slug, pdfUrl: folder.pdfUrl });
}

console.log(
	`${candidates.length} retailer(s) with a renderable PDF` +
		(force ? " (--force: re-rendering even where pages exist)" : " and no pages") +
		":",
);
for (const c of candidates) console.log(`  ${c.slug}`);
if (dryRun || candidates.length === 0) {
	console.log(dryRun ? "\nDry run — nothing rendered." : "\nNothing to do.");
	process.exit(0);
}

const browser = await puppeteer.launch({
	headless: true,
	executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
	args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const week = isoWeekTag();
let totalPages = 0;
const succeeded: string[] = [];
const failed: string[] = [];

for (const { slug, pdfUrl } of candidates) {
	const page = await browser.newPage();
	try {
		// Fetch happens in the page, so land on the PDF's own origin first —
		// otherwise a cross-origin read is blocked and nothing renders.
		const origin = pdfOrigin(pdfUrl);
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
			failed.push(slug);
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
			const base = `${slug}-${week}-pdfimg-p${n}`;
			const img = await sharp(raw, { limitInputPixels: false })
				.webp({ quality: PAGE_QUALITY })
				.toBuffer();
			const thumb = await sharp(raw, { limitInputPixels: false })
				.resize({ width: THUMB_WIDTH, withoutEnlargement: true })
				.webp({ quality: THUMB_QUALITY })
				.toBuffer();

			fs.writeFileSync(path.join(shotsDir, `${base}.webp`), img);
			fs.writeFileSync(path.join(shotsDir, `${base}-thumb.webp`), thumb);
			written.push({
				pageNumber: n,
				imageUrl: `/screenshots/${base}.webp`,
				thumbnailUrl: `/screenshots/${base}-thumb.webp`,
				deals: [],
			});
		}

		if (written.length === 0) {
			console.log("every rendered page was blank, left framing its PDF");
			failed.push(slug);
			continue;
		}

		const jsonPath = path.join(foldersDir, `${slug}.json`);
		const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
		const folder = data.folders[0];
		folder.pages = written;
		folder.pageCount = written.length;
		folder.thumbnailUrl = written[0].imageUrl;
		fs.writeFileSync(jsonPath, JSON.stringify(data, null, "\t") + "\n");

		totalPages += written.length;
		succeeded.push(slug);
		console.log(`${written.length} page(s) of ${docPages}`);
	} catch (err) {
		console.log(`failed: ${err}`);
		failed.push(slug);
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
		`${failed.length} still framing their PDF: ${failed.join(", ")}. ` +
			`These are unchanged, not broken.`,
	);
}
