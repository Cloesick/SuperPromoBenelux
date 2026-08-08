// ---------------------------------------------------------------------------
// Render a PDF leaflet to page images.
//
// Seventeen retailers publish their folder only as a PDF. The viewer framed it
// in an <iframe>, which means the visitor gets the browser's PDF plugin: no
// thumbnails, no page images we can serve, nothing for image search to index,
// and on mobile frequently a grey box. Rendering the PDF ourselves turns those
// folders into the same page images every other retailer has.
//
// pdf.js runs *inside the headless browser we already drive*, rendering each
// page to a <canvas>. The alternative — pdfjs-dist in Node — needs a native
// canvas binding, which is a compiled dependency that breaks per platform and
// per Node version. The browser is already there and already has a canvas.
//
// Chrome's built-in PDF viewer was the earlier approach: open the PDF and
// screenshot viewport slices. It is unreliable — slices cut across page
// boundaries, and when the plugin has not painted yet it yields a uniformly
// blank frame, which is how zalando shipped a blank image as its entire
// folder. pdf.js gives exact page boundaries and a deterministic result.
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import type { Page } from "rebrowser-puppeteer";

/** Width to render at, matching BaseScraper.PAGE_IMAGE_WIDTH. */
const RENDER_WIDTH = 1800;

/** A page that renders smaller than this is a cover stub, not a leaflet page. */
const MIN_RENDER_WIDTH = 400;

let cachedSources: { pdf: string; worker: string } | null = null;

/**
 * The pdf.js browser bundles, read from node_modules once per process.
 *
 * Located by walking up from the working directory rather than through
 * `require.resolve` or `import.meta.url`: this module is loaded both by the
 * scraper (which tsx compiles to CJS) and by an ESM script, and each of those
 * resolution mechanisms is a syntax error in the other module system.
 */
function pdfJsSources(): { pdf: string; worker: string } {
	if (cachedSources) return cachedSources;

	let dir = process.cwd();
	for (let i = 0; i < 5; i++) {
		const candidate = path.join(dir, "node_modules", "pdfjs-dist", "legacy", "build");
		if (fs.existsSync(path.join(candidate, "pdf.min.mjs"))) {
			cachedSources = {
				pdf: fs.readFileSync(path.join(candidate, "pdf.min.mjs"), "utf8"),
				worker: fs.readFileSync(path.join(candidate, "pdf.worker.min.mjs"), "utf8"),
			};
			return cachedSources;
		}
		dir = path.dirname(dir);
	}
	throw new Error("pdfjs-dist browser bundles not found under node_modules");
}

export interface RenderedPdf {
	/** PNG bytes per page, in order. */
	pages: Buffer[];
	/** Pages the document actually has, which may exceed what was rendered. */
	totalPages: number;
}

/**
 * Render up to `maxPages` of a PDF to PNG buffers.
 *
 * The page must already be on an origin that can fetch the PDF — the fetch
 * happens in the browser so it carries whatever cookies the viewer set. A
 * cross-origin PDF served without CORS cannot be read this way, so callers
 * should navigate to the PDF's own host first.
 *
 * Returns an empty result rather than throwing: a folder that cannot be
 * rendered should fall back to framing the PDF, not fail the scrape.
 */
export async function renderPdfToImages(
	page: Page,
	pdfUrl: string,
	// 80 covers the longest leaflet observed (alvo, 76 pages). Unlike the
	// screenshot loop, which probes for the end of a folder, a PDF states its
	// own page count — so a cap here only ever truncates real content.
	maxPages = 80,
	log: (msg: string) => void = () => {},
): Promise<RenderedPdf> {
	const { pdf, worker } = pdfJsSources();

	try {
		const result = (await page.evaluate(
			async (pdfSrc: string, workerSrc: string, url: string, max: number, width: number) => {
				try {
					// Blob URLs rather than <script> tags: pdf.js ships as an ES
					// module, and a dynamic import of a blob is the only way to load
					// one into a page without a bundler.
					const mod = await import(
						URL.createObjectURL(new Blob([pdfSrc], { type: "text/javascript" }))
					);
					mod.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
						new Blob([workerSrc], { type: "text/javascript" }),
					);

					const resp = await fetch(url);
					if (!resp.ok) return { error: `fetch returned ${resp.status}` };
					const data = new Uint8Array(await resp.arrayBuffer());

					const doc = await mod.getDocument({ data }).promise;
					const out: string[] = [];
					const count = Math.min(doc.numPages, max);
					for (let i = 1; i <= count; i++) {
						const p = await doc.getPage(i);
						const base = p.getViewport({ scale: 1 });
						const viewport = p.getViewport({ scale: width / base.width });
						const canvas = document.createElement("canvas");
						canvas.width = Math.ceil(viewport.width);
						canvas.height = Math.ceil(viewport.height);
						const ctx = canvas.getContext("2d");
						if (!ctx) return { error: "no 2d context" };
						await p.render({ canvasContext: ctx, viewport, canvas }).promise;
						out.push(canvas.toDataURL("image/png"));
					}
					return { totalPages: doc.numPages, rendered: out };
				} catch (err) {
					return { error: String(err) };
				}
			},
			pdf,
			worker,
			pdfUrl,
			maxPages,
			RENDER_WIDTH,
		)) as { error?: string; totalPages?: number; rendered?: string[] };

		if (result.error || !result.rendered) {
			log(`  PDF render failed: ${result.error ?? "no output"}`);
			return { pages: [], totalPages: 0 };
		}

		const pages = result.rendered
			.map((dataUrl) => Buffer.from(dataUrl.split(",")[1] ?? "", "base64"))
			.filter((b) => b.length > 0);

		return { pages, totalPages: result.totalPages ?? pages.length };
	} catch (err) {
		log(`  PDF render threw: ${err}`);
		return { pages: [], totalPages: 0 };
	}
}

/** The origin a PDF should be fetched from, for same-origin navigation. */
export function pdfOrigin(pdfUrl: string): string | null {
	try {
		return new URL(pdfUrl).origin;
	} catch {
		return null;
	}
}

export { RENDER_WIDTH, MIN_RENDER_WIDTH };
