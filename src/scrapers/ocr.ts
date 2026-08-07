import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createWorker, type Worker } from "tesseract.js";
import { Deal } from "../lib/types";
import { parseTextToDeals } from "./extractDealsFromText";
import { dealsFromWords, type OcrWord } from "./ocrLayout";

// ---------------------------------------------------------------------------
// OCR for screenshot-only retailers
//
// Several large retailers (Colruyt, Delhaize, ALDI) publish their weekly
// leaflet exclusively through an embedded viewer — no PDF text layer, no HTML
// product markup. The scraper falls back to screenshotting the viewer, which
// yields images and therefore zero extractable deals.
//
// This module OCRs those screenshots so the same text->deal parser used for
// PDFs can run on them.
//
// Language data is loaded from the repo-local *.traineddata files rather than
// tesseract.js's CDN: it avoids a network round trip per run, and this machine
// sits behind TLS interception that breaks unauthenticated CDN fetches.
// ---------------------------------------------------------------------------

const SCREENSHOT_DIR = path.join(process.cwd(), "public", "screenshots");

// Full-resolution captures written alongside the optimised, served copies.
// Preferred when present: the served images are resized for page weight, which
// costs recognition accuracy.
const OCR_SOURCE_DIR = path.join(process.cwd(), "data", "ocr-src");

/** Directory holding eng/fra/nld .traineddata (repo root). */
const LANG_PATH = process.cwd();

/** Belgian leaflets are Dutch-first with French on bilingual pages. */
export const DEFAULT_OCR_LANGS = "nld+fra";

/** Below this mean confidence the text is too garbled to trust. */
export const MIN_CONFIDENCE = 45;

/** Cap pages per run — OCR is CPU-bound and leaflets repeat past ~12 pages. */
export const MAX_OCR_PAGES = 12;

// ---------------------------------------------------------------------------
// Image selection
// ---------------------------------------------------------------------------

/**
 * Rank screenshot filenames by how likely they are to contain leaflet content.
 *
 * base.ts writes several kinds of image into the same directory:
 *   {slug}-{year}-w{week}-viewerimg-p{n}  rendered leaflet viewer pages  (best)
 *   {slug}-{year}-w{week}-pdfimg-p{n}     rendered PDF pages             (best)
 *   {slug}-{year}-w{week}-screenshot-p{n} generic page captures          (mixed)
 *   {slug}-{timestamp}                    outer retailer page            (worst)
 *
 * The outer page is site chrome — navigation, cookie banners, footers. OCRing
 * it produces only noise, so it is excluded entirely.
 */
export function rankScreenshotCandidates(filenames: string[]): string[] {
	const score = (f: string): number => {
		if (/-viewerimg-p\d+\./.test(f)) return 0;
		if (/-pdfimg-p\d+\./.test(f)) return 0;
		if (/-pdf-p\d+\./.test(f)) return 1;
		if (/-screenshot-p\d+\./.test(f)) return 2;
		return 99; // outer page / unknown — excluded below
	};

	const pageNo = (f: string): number => {
		const m = f.match(/-p(\d+)\./);
		return m ? parseInt(m[1], 10) : 0;
	};

	return filenames
		.filter((f) => score(f) < 99)
		.sort((a, b) => score(a) - score(b) || pageNo(a) - pageNo(b));
}

/**
 * Find leaflet screenshots on disk for a retailer.
 * When `week` is given ("2026-w32") only that week's images are returned,
 * which is what backfilling historical weeks relies on.
 */
export function findScreenshots(retailerSlug: string, week?: string): string[] {
	const prefix = week ? `${retailerSlug}-${week}-` : `${retailerSlug}-`;
	const matching = (dir: string): string[] => {
		if (!fs.existsSync(dir)) return [];
		return fs
			.readdirSync(dir)
			.filter((f) => f.startsWith(prefix) && /\.(webp|png|jpe?g)$/i.test(f));
	};

	// Merge both directories rather than picking one. The old rule took OCR
	// sources whenever the directory had *any* match, so a single stale file
	// shadowed everything else: ALDI's 34 leaflet pages are .jpg written by the
	// iPaper direct-fetch path, which keeps no full-resolution copy, and one
	// leftover .webp in data/ocr-src meant OCR saw one page instead of 34.
	//
	// Keyed by filename stem so the same page is never queued twice; the
	// full-resolution copy wins when both exist, because the served image is
	// downscaled for page weight and that costs recognition accuracy.
	const candidates = new Map<string, string>();
	for (const [dir, files] of [
		[SCREENSHOT_DIR, matching(SCREENSHOT_DIR)],
		[OCR_SOURCE_DIR, matching(OCR_SOURCE_DIR)],
	] as [string, string[]][]) {
		for (const file of files) {
			// Thumbnails are downscaled derivatives; OCR must never read them.
			if (/-thumb\.[a-z]+$/i.test(file)) continue;
			const stem = file.replace(/\.[^.]+$/, "");
			candidates.set(stem, path.join(dir, file));
		}
	}

	// Rank on the real basenames — the scoring patterns match on the extension
	// boundary, so stems alone would score everything as unknown and be dropped.
	const byBasename = new Map<string, string>();
	for (const full of candidates.values()) byBasename.set(path.basename(full), full);
	const ranked = rankScreenshotCandidates([...byBasename.keys()]).map(
		(base) => byBasename.get(base)!,
	);

	// Drop byte-identical files before the MAX_OCR_PAGES slice. data/ocr-src
	// accumulated captures written before duplicate collapsing existed — douglas
	// held 72 files with 6 distinct images, lidl 83 with 6 — so without this the
	// page budget is spent OCRing the same image a dozen times at seconds apiece.
	// Ranking runs first so the survivor of each duplicate set is the
	// best-named candidate, not an arbitrary one.
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const full of ranked) {
		let digest: string;
		try {
			digest = crypto.createHash("md5").update(fs.readFileSync(full)).digest("hex");
		} catch {
			// Unreadable here means unreadable for OCR too; keep it and let the
			// recognition step report the failure.
			unique.push(full);
			continue;
		}
		if (seen.has(digest)) continue;
		seen.add(digest);
		unique.push(full);
	}

	return unique;
}

// ---------------------------------------------------------------------------
// Preprocessing
// ---------------------------------------------------------------------------

/** Width Tesseract reads leaflet text most reliably at. */
export const OCR_TARGET_WIDTH = 2400;

/**
 * Ceiling on either dimension. Full-page captures of long scrolling pages run
 * to 16000px tall; blindly upscaling those produced 280-megapixel images that
 * Tesseract could not process at all, so those retailers silently yielded
 * nothing.
 */
export const OCR_MAX_DIMENSION = 8000;

/**
 * Prepare an image for OCR.
 *
 * Scales *towards* a target width rather than by a fixed factor: small viewer
 * captures are enlarged so price text clears Tesseract's minimum, and oversized
 * full-page captures are reduced to stay tractable. Greyscale plus contrast
 * normalisation and sharpening lift recognition further. Also converts WebP,
 * which Tesseract cannot decode natively.
 */
export async function preprocessForOcr(
	imagePath: string,
	targetWidth = OCR_TARGET_WIDTH,
): Promise<Buffer> {
	const img = sharp(imagePath, { limitInputPixels: false });
	const meta = await img.metadata();

	// Fit inside a bounded box: upscales narrow captures, downscales huge ones,
	// and preserves aspect ratio in both directions.
	const width = Math.min(targetWidth, OCR_MAX_DIMENSION);
	const height = OCR_MAX_DIMENSION;

	const needsResize =
		!meta.width || !meta.height || meta.width !== width || meta.height > height;

	let pipeline = img;
	if (needsResize) {
		pipeline = pipeline.resize({
			width,
			height,
			fit: "inside",
			withoutEnlargement: false,
		});
	}

	return pipeline.greyscale().normalise().sharpen().png().toBuffer();
}

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

export interface OcrPageResult {
	imagePath: string;
	text: string;
	confidence: number;
	/** Word-level geometry, used to rebuild product cards spatially. */
	words: OcrWord[];
}

/**
 * Flatten Tesseract's block/paragraph/line/word hierarchy into a word list.
 *
 * On leaflet pages Tesseract's own layout analysis usually returns a single
 * block spanning the whole spread, so the hierarchy above word level carries
 * no useful structure — the geometry does.
 */
function flattenWords(blocks: unknown): OcrWord[] {
	const out: OcrWord[] = [];
	const blockList = Array.isArray(blocks) ? blocks : [];

	for (const block of blockList as any[]) {
		for (const para of block?.paragraphs ?? []) {
			for (const line of para?.lines ?? []) {
				for (const w of line?.words ?? []) {
					const text = typeof w?.text === "string" ? w.text.trim() : "";
					const bbox = w?.bbox;
					if (!text || !bbox) continue;
					out.push({
						text,
						bbox: { x0: bbox.x0, y0: bbox.y0, x1: bbox.x1, y1: bbox.y1 },
						confidence: typeof w.confidence === "number" ? w.confidence : 0,
					});
				}
			}
		}
	}

	return out;
}

async function createOcrWorker(langs: string): Promise<Worker> {
	return createWorker(langs, 1, { langPath: LANG_PATH, gzip: false });
}

/**
 * OCR a list of images with a single shared worker.
 * Pages whose confidence falls below MIN_CONFIDENCE are dropped rather than
 * passed on — garbled text produces phantom products and false prices.
 */
export async function ocrImages(
	imagePaths: string[],
	opts: { langs?: string; maxPages?: number; onProgress?: (msg: string) => void } = {},
): Promise<OcrPageResult[]> {
	const { langs = DEFAULT_OCR_LANGS, maxPages = MAX_OCR_PAGES, onProgress } = opts;
	const targets = imagePaths.slice(0, maxPages);
	if (targets.length === 0) return [];

	const worker = await createOcrWorker(langs);
	const results: OcrPageResult[] = [];

	try {
		for (const imagePath of targets) {
			try {
				const png = await preprocessForOcr(imagePath);
				const { data } = await worker.recognize(png, {}, { blocks: true, text: true });
				const confidence = data.confidence ?? 0;

				if (confidence < MIN_CONFIDENCE) {
					onProgress?.(
						`  OCR skipped ${path.basename(imagePath)} (confidence ${Math.round(confidence)} < ${MIN_CONFIDENCE})`,
					);
					continue;
				}

				const words = flattenWords((data as { blocks?: unknown }).blocks);
				results.push({ imagePath, text: data.text ?? "", confidence, words });
				onProgress?.(
					`  OCR ${path.basename(imagePath)}: ${words.length} words, confidence ${Math.round(confidence)}`,
				);
			} catch (err) {
				onProgress?.(`  OCR failed for ${path.basename(imagePath)}: ${err}`);
			}
		}
	} finally {
		await worker.terminate();
	}

	return results;
}

// ---------------------------------------------------------------------------
// Screenshots -> deals
// ---------------------------------------------------------------------------

export interface OcrExtractionResult {
	deals: Deal[];
	pagesProcessed: number;
	averageConfidence: number;
}

/**
 * OCR a retailer's leaflet screenshots and parse deals from the result.
 *
 * Output still passes through sanitizeDeals() in productsDb before storage,
 * so OCR noise that survives the confidence gate is filtered there.
 */
export async function extractDealsFromScreenshots(
	retailerSlug: string,
	validFrom: string,
	validUntil: string,
	opts: {
		week?: string;
		langs?: string;
		maxPages?: number;
		onProgress?: (msg: string) => void;
	} = {},
): Promise<OcrExtractionResult> {
	const images = findScreenshots(retailerSlug, opts.week);
	if (images.length === 0) {
		return { deals: [], pagesProcessed: 0, averageConfidence: 0 };
	}

	opts.onProgress?.(`  OCR: ${images.length} candidate image(s) for ${retailerSlug}`);

	const pages = await ocrImages(images, {
		langs: opts.langs,
		maxPages: opts.maxPages,
		onProgress: opts.onProgress,
	});

	if (pages.length === 0) return { deals: [], pagesProcessed: 0, averageConfidence: 0 };

	// Cluster per page: bounding boxes are page-local, so pooling words across
	// pages would let a card on page 3 merge with one on page 4.
	const deals: Deal[] = [];
	for (const page of pages) {
		const pageDeals = dealsFromWords(page.words, retailerSlug, validFrom, validUntil);
		deals.push(
			...pageDeals.map((d, i) => ({
				...d,
				id: `${retailerSlug}-ocr-${path.basename(page.imagePath, path.extname(page.imagePath))}-${i}`,
			})),
		);
	}

	// Fall back to flat text parsing only when geometry produced nothing —
	// some pages carry a usable text layer but no reliable word boxes.
	if (deals.length === 0) {
		const combined = pages.map((p) => p.text).join("\n");
		deals.push(
			...parseTextToDeals(combined, retailerSlug, validFrom, validUntil, "ocr"),
		);
		if (deals.length > 0) {
			opts.onProgress?.(`  OCR: geometry yielded nothing, fell back to flat text`);
		}
	}

	const averageConfidence =
		pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length;

	opts.onProgress?.(
		`  OCR yielded ${deals.length} deal(s) from ${pages.length} page(s), mean confidence ${Math.round(averageConfidence)}`,
	);

	return { deals, pagesProcessed: pages.length, averageConfidence };
}
