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
//
// Pages are rendered ONE PER page.evaluate rather than all inside a single
// call. Rendering the whole leaflet at once accumulated every page as a base64
// data URL in one array before returning anything: for etos (69 pages, 62 MB)
// and jumbo (55 pages, 213 MB) that exhausted the renderer, and the symptom
// reaching CI was "Runtime.callFunctionOn timed out" — a timeout standing in
// for memory. One page per call bounds both the memory held at any moment and
// the time charged to a single protocol call.
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import type { Page } from "rebrowser-puppeteer";

/** Width to render at, matching BaseScraper.PAGE_IMAGE_WIDTH. */
const RENDER_WIDTH = 1800;

/** A page that renders smaller than this is a cover stub, not a leaflet page. */
const MIN_RENDER_WIDTH = 400;

/**
 * Property on `window` the open document is parked under between calls.
 *
 * The document has to outlive a single evaluate, and only a serialisable value
 * can cross the CDP boundary — so the document stays in the page and each call
 * looks it up by name.
 */
const DOC_HANDLE = "__superpromoPdfDoc";

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
		// Open the document and leave it in the page. Nothing is rendered yet, so
		// the only thing held after this call is the PDF itself.
		const opened = (await page.evaluate(
			async (pdfSrc: string, workerSrc: string, url: string, handle: string) => {
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
					(window as unknown as Record<string, unknown>)[handle] = doc;
					return { totalPages: doc.numPages as number };
				} catch (err) {
					return { error: String(err) };
				}
			},
			pdf,
			worker,
			pdfUrl,
			DOC_HANDLE,
		)) as { error?: string; totalPages?: number };

		if (opened.error || !opened.totalPages) {
			log(`  PDF render failed: ${opened.error ?? "document reported no pages"}`);
			return { pages: [], totalPages: 0 };
		}

		const totalPages = opened.totalPages;
		const count = Math.min(totalPages, maxPages);
		const pages: Buffer[] = [];

		for (let n = 1; n <= count; n++) {
			const result = (await page.evaluate(
				async (pageNumber: number, width: number, handle: string) => {
					try {
						const doc = (window as unknown as Record<string, unknown>)[handle] as
							| {
									getPage: (n: number) => Promise<{
										getViewport: (o: { scale: number }) => {
											width: number;
											height: number;
										};
										render: (o: unknown) => { promise: Promise<void> };
										cleanup: () => void;
									}>;
							  }
							| undefined;
						// A navigation would have torn down the execution context and
						// taken the document with it.
						if (!doc) return { error: "document is no longer on the page" };

						const p = await doc.getPage(pageNumber);
						const base = p.getViewport({ scale: 1 });
						const viewport = p.getViewport({ scale: width / base.width });
						const canvas = document.createElement("canvas");
						canvas.width = Math.ceil(viewport.width);
						canvas.height = Math.ceil(viewport.height);
						const ctx = canvas.getContext("2d");
						if (!ctx) return { error: "no 2d context" };
						await p.render({ canvasContext: ctx, viewport, canvas }).promise;
						const dataUrl = canvas.toDataURL("image/png");

						// Hand back the backing store before the next page allocates
						// its own. Without this the canvases pile up exactly the way
						// the data URLs used to.
						canvas.width = 0;
						canvas.height = 0;
						p.cleanup();

						return { dataUrl };
					} catch (err) {
						return { error: String(err) };
					}
				},
				n,
				RENDER_WIDTH,
				DOC_HANDLE,
			)) as { error?: string; dataUrl?: string };

			if (result.error || !result.dataUrl) {
				// Stop rather than press on: whatever exhausted the renderer on this
				// page will do the same on the next. Callers report "N page(s) of M",
				// so a short folder shows up as short instead of passing silently.
				log(
					`  PDF render stopped at page ${n} of ${count}: ` +
						`${result.error ?? "no output"}`,
				);
				break;
			}

			const bytes = Buffer.from(result.dataUrl.split(",")[1] ?? "", "base64");
			if (bytes.length > 0) pages.push(bytes);
		}

		return { pages, totalPages };
	} catch (err) {
		log(`  PDF render threw: ${err}`);
		return { pages: [], totalPages: 0 };
	} finally {
		// Drop the document whichever way the function left, so a browser reused
		// across retailers does not carry one leaflet's bytes into the next.
		await page
			.evaluate((handle: string) => {
				const w = window as unknown as Record<string, unknown>;
				const doc = w[handle] as { destroy?: () => void } | undefined;
				try {
					doc?.destroy?.();
				} catch {
					// Already gone; nothing to release.
				}
				delete w[handle];
			}, DOC_HANDLE)
			.catch(() => {
				// The page can be closed or navigated by now — the context, and the
				// document with it, is gone either way.
			});
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
