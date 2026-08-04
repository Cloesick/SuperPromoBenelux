import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createWorker, type Worker } from "tesseract.js";
import { Deal } from "../lib/types";
import { parseTextToDeals } from "./extractDealsFromText";

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
	if (!fs.existsSync(SCREENSHOT_DIR)) return [];

	const prefix = week ? `${retailerSlug}-${week}-` : `${retailerSlug}-`;
	const all = fs
		.readdirSync(SCREENSHOT_DIR)
		.filter((f) => f.startsWith(prefix) && /\.(webp|png|jpe?g)$/i.test(f));

	return rankScreenshotCandidates(all).map((f) => path.join(SCREENSHOT_DIR, f));
}

// ---------------------------------------------------------------------------
// Preprocessing
// ---------------------------------------------------------------------------

/**
 * Prepare an image for OCR.
 *
 * Viewer screenshots are 1440x900 at ~25 dpi, well below the ~300 dpi Tesseract
 * expects. Upscaling, flattening to greyscale and normalising contrast lifts
 * recognition of leaflet price text substantially. Also converts WebP, which
 * Tesseract cannot decode natively.
 */
export async function preprocessForOcr(imagePath: string, scale = 2): Promise<Buffer> {
	const img = sharp(imagePath);
	const meta = await img.metadata();
	const width = meta.width ? Math.round(meta.width * scale) : undefined;

	return img
		.resize({ width, withoutEnlargement: false })
		.greyscale()
		.normalise()
		.sharpen()
		.png()
		.toBuffer();
}

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

export interface OcrPageResult {
	imagePath: string;
	text: string;
	confidence: number;
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
				const { data } = await worker.recognize(png);
				const confidence = data.confidence ?? 0;

				if (confidence < MIN_CONFIDENCE) {
					onProgress?.(
						`  OCR skipped ${path.basename(imagePath)} (confidence ${Math.round(confidence)} < ${MIN_CONFIDENCE})`,
					);
					continue;
				}

				results.push({ imagePath, text: data.text ?? "", confidence });
				onProgress?.(
					`  OCR ${path.basename(imagePath)}: ${data.text?.length ?? 0} chars, confidence ${Math.round(confidence)}`,
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

	const combined = pages.map((p) => p.text).join("\n");
	const deals = parseTextToDeals(combined, retailerSlug, validFrom, validUntil, "ocr");
	const averageConfidence =
		pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length;

	opts.onProgress?.(
		`  OCR yielded ${deals.length} deal(s) from ${pages.length} page(s), mean confidence ${Math.round(averageConfidence)}`,
	);

	return { deals, pagesProcessed: pages.length, averageConfidence };
}
