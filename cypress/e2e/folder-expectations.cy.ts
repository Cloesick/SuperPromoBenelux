// ---------------------------------------------------------------------------
// Every folder of every retailer, checked against a stated expectation.
//
// The other specs check that the app behaves; this one checks that each of the
// 46 retailers actually delivers a folder. It exists because the failures this
// project shipped were never crashes — they were pages that looked fine and
// showed nothing: full viewer chrome around images that 404, a leaflet
// truncated from 34 pages to 1, a folder six weeks expired still in the
// sitemap. All of that passes a smoke test.
//
// Two layers:
//
//   Invariants   hand-written rules any correct folder page must satisfy,
//                asserted for every retailer regardless of its data.
//
//   Baseline     cypress/fixtures/folder-expectations.json — per-retailer
//                render mode and a page-count floor, committed so that a
//                retailer degrading has to show up in a diff. Regenerate with
//                scripts/generate-folder-expectations.mjs, deliberately.
//
// Image integrity is checked over HTTP for *every* page image (cheap, and it
// covers all 122), while decode-and-paint is checked in the browser for the
// pages a visitor actually sees first.
// ---------------------------------------------------------------------------

import expectations from "../fixtures/folder-expectations.json";

type Mode = "pages" | "embed" | "pdf" | "empty";

interface Expectation {
	mode: Mode;
	minPages: number | null;
	observedPages: number;
	expired: boolean;
}

interface FolderPage {
	pageNumber: number;
	imageUrl: string;
	thumbnailUrl?: string;
}

interface Folder {
	title?: string;
	validFrom: string;
	validUntil: string;
	pages?: FolderPage[];
	embedUrl?: string;
	pdfUrl?: string;
	thumbnailUrl?: string;
}

const retailers = expectations.retailers as Record<string, Expectation>;
const slugs = Object.keys(retailers).sort();

/** A leaflet page narrower than this is a thumbnail or a blank, not content. */
const MIN_PAGE_IMAGE_WIDTH = 700;

/** Smallest plausible leaflet page. Blank captures came in far under this. */
const MIN_PAGE_IMAGE_BYTES = 5_000;

/**
 * Click "next page" until the viewer actually advances.
 *
 * The page indicator is server-rendered, so `cy.contains("Pagina 1 van")`
 * succeeds before React has attached its click handler. A single click landing
 * in that window does nothing, and Cypress does not retry *actions* — only
 * assertions — so the test fails on a page that works perfectly. This showed up
 * as Douglas failing in a full run while passing in isolation, which is the
 * signature of a hydration race rather than a bug.
 *
 * Retrying the click is the fix: once hydrated, the first one takes.
 */
function advanceToPageTwo(attempt = 0): void {
	cy.get("[aria-label='Volgende pagina']").first().click({ force: true });
	cy.get("body").then(($body) => {
		if (/Pagina\s+2\s+van/.test($body.text()) || attempt >= 5) return;
		cy.wait(200);
		advanceToPageTwo(attempt + 1);
	});
}

/** Read a retailer's folder data the same way the server does. */
function loadFolder(slug: string): Cypress.Chainable<Folder | null> {
	return cy.readFile(`data/folders/${slug}.json`).then((data) => {
		const folder = (data.folders ?? [])[0] ?? null;
		return folder as Folder | null;
	});
}

describe("Folder expectations — every retailer", () => {
	slugs.forEach((slug) => {
		const expected = retailers[slug];

		describe(`${slug} (expects: ${expected.mode}${
			expected.minPages ? `, >=${expected.minPages} pages` : ""
		})`, () => {
			beforeEach(() => {
				cy.visit(`/folders/${slug}`);
			});

			// -- Behaviour ----------------------------------------------------

			it("renders the retailer's folder page", () => {
				cy.get("h1").should("be.visible").and("not.be.empty");
			});

			it("shows the mode its data implies, never an unexplained blank", () => {
				cy.get("body").should(($body) => {
					const text = $body.text();
					const hasPages = $body.find("img[alt*='folder pagina']").length > 0;
					const hasFrame = $body.find("iframe").length > 0;
					// An empty state is only acceptable when the data has nothing to
					// show. It must still say so in words — the failure mode being
					// guarded against is chrome wrapped around nothing.
					const hasEmptyState =
						/(?:binnenkort|kunnen we hier niet tonen|nog geen folder beschikbaar|momenteel geen)/i.test(
							text,
						);

					if (expected.mode === "pages") {
						expect(hasPages, `${slug}: captured pages must render as images`).to.equal(
							true,
						);
					} else if (expected.mode === "embed" || expected.mode === "pdf") {
						expect(
							hasFrame || hasPages || hasEmptyState,
							`${slug}: a framed folder must show a frame, pages, or say why not`,
						).to.equal(true);
					} else {
						expect(
							hasEmptyState || hasFrame || hasPages,
							`${slug}: an empty folder must say so`,
						).to.equal(true);
					}
				});
			});

			if (expected.mode === "pages") {
				it("agrees with its data on how many pages there are", () => {
					loadFolder(slug).then((folder) => {
						const count = folder?.pages?.length ?? 0;
						// "Pagina 1 van 16" is the claim a visitor sees. It disagreeing
						// with the data is how a truncated folder hides.
						cy.contains(/Pagina\s+\d+\s+van\s+\d+/)
							.invoke("text")
							.then((text) => {
								const total = Number(/van\s+(\d+)/.exec(text)?.[1]);
								expect(total, `${slug}: page count shown vs stored`).to.equal(count);
							});
					});
				});

				if (expected.minPages !== null) {
					it(`still delivers at least ${expected.minPages} pages`, () => {
						loadFolder(slug).then((folder) => {
							const count = folder?.pages?.length ?? 0;
							expect(
								count,
								`${slug} collapsed to ${count} pages (baseline floor ${expected.minPages}, ` +
									`was ${expected.observedPages} when the baseline was set). ` +
									`If this is a real change, regenerate the baseline.`,
							).to.be.at.least(expected.minPages);
						});
					});
				}

				it("moves to the next page when asked", () => {
					loadFolder(slug).then((folder) => {
						if ((folder?.pages?.length ?? 0) < 2) return;
						cy.contains(/Pagina\s+1\s+van/).should("exist");
						advanceToPageTwo();
						cy.contains(/Pagina\s+2\s+van/).should("exist");
					});
				});

				it("offers one thumbnail per page", () => {
					loadFolder(slug).then((folder) => {
						const count = folder?.pages?.length ?? 0;
						if (count < 2) return;
						cy.get("img[alt^='Pagina ']").should("have.length", count);
					});
				});
			}

			// -- Visuals ------------------------------------------------------

			if (expected.mode === "pages") {
				it("paints a real image, not a broken one", () => {
					// naturalWidth is 0 for an image that failed to load, which is
					// exactly what a 404 behind full viewer chrome looks like.
					cy.get("img[alt*='folder pagina']")
						.first()
						.should(($img) => {
							const img = $img[0] as HTMLImageElement;
							expect(img.naturalWidth, `${slug}: cover failed to decode`).to.be.greaterThan(
								0,
							);
							expect(
								img.naturalWidth,
								`${slug}: cover is ${img.naturalWidth}px — too small to read`,
							).to.be.at.least(MIN_PAGE_IMAGE_WIDTH);
						});
				});

				it("paints every page, not just the first", () => {
					// The goal is that a visitor can page through the whole leaflet
					// and see every page. Checking only the cover misses the case
					// that actually happens: one bad capture in the middle of an
					// otherwise healthy folder, which no amount of HTTP checking
					// catches because the file exists — it just doesn't decode, or
					// decodes to something too small to read.
					loadFolder(slug).then((folder) => {
						const total = folder?.pages?.length ?? 0;
						for (let i = 0; i < total; i++) {
							if (i > 0) {
								cy.get("[aria-label='Volgende pagina']")
									.first()
									.click({ force: true });
							}
							cy.get("img[alt*='folder pagina']")
								.should("be.visible")
								.and(($img) => {
									const img = $img[0] as HTMLImageElement;
									expect(
										img.naturalWidth,
										`${slug} page ${i + 1}: did not decode`,
									).to.be.greaterThan(0);
									expect(
										img.naturalWidth,
										`${slug} page ${i + 1}: ${img.naturalWidth}px is too small to read`,
									).to.be.at.least(MIN_PAGE_IMAGE_WIDTH);
									// `complete` is false while a decode is still in
									// flight, so this is what "fully loaded" means.
									expect(
										img.complete,
										`${slug} page ${i + 1}: still loading`,
									).to.equal(true);
								});
						}
					});
				});

				it("serves every one of its page images", () => {
					// Over HTTP rather than in the DOM: this covers all pages of all
					// retailers without paying to render them.
					loadFolder(slug).then((folder) => {
						const pages = folder?.pages ?? [];
						expect(pages.length, `${slug}: expected pages`).to.be.greaterThan(0);
						pages.forEach((page) => {
							cy.request({ url: page.imageUrl, encoding: "binary" }).then((res) => {
								expect(res.status, `${slug} ${page.imageUrl}`).to.equal(200);
								expect(
									res.body.length,
									`${slug} ${page.imageUrl} is ${res.body.length} bytes — blank or truncated`,
								).to.be.greaterThan(MIN_PAGE_IMAGE_BYTES);
							});
						});
					});
				});

				it("has no duplicate pages left in it", () => {
					// Deduplication runs at capture time; if it regresses, a folder
					// fills with repeats of the same spread and reads as longer than
					// it is. Distinct byte lengths are a cheap proxy for distinct
					// images and need no hashing in the browser.
					loadFolder(slug).then((folder) => {
						const pages = folder?.pages ?? [];
						if (pages.length < 3) return;
						const sizes: number[] = [];
						pages.forEach((page) => {
							cy.request({ url: page.imageUrl, encoding: "binary" }).then((res) => {
								sizes.push(res.body.length);
							});
						});
						cy.then(() => {
							const unique = new Set(sizes).size;
							// Allow one collision: two genuinely different pages can
							// compress to the same length.
							expect(
								unique,
								`${slug}: ${pages.length} pages but only ${unique} distinct image sizes`,
							).to.be.at.least(sizes.length - 1);
						});
					});
				});
			}

			it("does not scroll sideways", () => {
				// Leaflet pages are wide; a viewer that lets the body scroll
				// horizontally makes the whole site feel broken on a phone.
				cy.document().then((doc) => {
					const el = doc.documentElement;
					expect(
						el.scrollWidth,
						`${slug}: body scrolls horizontally (${el.scrollWidth} > ${el.clientWidth})`,
					).to.be.at.most(el.clientWidth + 1);
				});
			});

			// -- Freshness and indexing ---------------------------------------

			it("is not showing an expired leaflet as current", () => {
				loadFolder(slug).then((folder) => {
					if (!folder?.validUntil) return;
					const expired = new Date(`${folder.validUntil}T23:59:59`) < new Date();
					if (!expired) return;
					// An expired folder may still be displayed, but it has to say so
					// rather than presenting last month's prices as this week's.
					cy.get("body")
						.invoke("text")
						.should("match", /(?:verlopen|binnenkort|niet meer geldig|nieuwe folder)/i);
				});
			});

			it("is indexed only when it shows something", () => {
				loadFolder(slug).then((folder) => {
					const expired =
						!!folder?.validUntil &&
						new Date(`${folder.validUntil}T23:59:59`) < new Date();
					const shows = (folder?.pages?.length ?? 0) > 0 || expected.mode !== "empty";
					const shouldIndex = shows && !expired;

					cy.request(`/folders/${slug}`).then((res) => {
						const noindex = /name="robots"[^>]*content="[^"]*noindex/.test(res.body);
						expect(
							!noindex,
							`${slug}: indexable=${!noindex} but should be ${shouldIndex}`,
						).to.equal(shouldIndex);
					});
				});
			});

			it("describes itself to search engines", () => {
				cy.request(`/folders/${slug}`).then((res) => {
					const blocks = String(res.body).match(
						/<script type="application\/ld\+json">(.*?)<\/script>/gs,
					);
					expect(blocks, `${slug}: no JSON-LD at all`).to.not.equal(null);
					const parsed = (blocks ?? []).map((b) =>
						JSON.parse(b.replace(/^[^>]*>/, "").replace(/<\/script>$/, "")),
					);
					const page = parsed.find((o) => o["@type"] === "WebPage");
					expect(page, `${slug}: no WebPage JSON-LD`).to.not.equal(undefined);
					expect(page.url, `${slug}: JSON-LD url`).to.contain(`/folders/${slug}`);
					// dateModified is the freshness signal for weekly content; without
					// it a crawler cannot tell this week's leaflet from last week's.
					expect(page.dateModified, `${slug}: JSON-LD missing dateModified`).to.be.a(
						"string",
					);
				});
			});
		});
	});

	// -- Cross-cutting -------------------------------------------------------

	it("puts exactly the indexable folders in the sitemap", () => {
		cy.request("/sitemap.xml").then((res) => {
			const inSitemap = new Set(
				[...String(res.body).matchAll(/\/folders\/([a-z0-9-]+)</g)].map((m) => m[1]),
			);
			const mismatches: string[] = [];
			const checks = slugs.map((slug) =>
				cy.request(`/folders/${slug}`).then((page) => {
					const noindex = /name="robots"[^>]*content="[^"]*noindex/.test(page.body);
					if (inSitemap.has(slug) === noindex) {
						mismatches.push(
							`${slug} (sitemap=${inSitemap.has(slug)}, noindex=${noindex})`,
						);
					}
				}),
			);
			cy.wrap(checks).then(() => {
				// The sitemap and the robots tag share one predicate. If they ever
				// disagree, the predicate has been duplicated somewhere.
				expect(mismatches.join(", "), "sitemap/robots disagreements").to.equal("");
			});
		});
	});

	it("still covers every retailer that has folder data", () => {
		// A retailer added to data/folders without a baseline entry would be
		// silently untested by this whole spec.
		cy.task("listFolderSlugs").then((onDisk: unknown) => {
			const missing = (onDisk as string[]).filter((s) => !slugs.includes(s));
			expect(missing.join(", "), "retailers with no expectation entry").to.equal("");
		});
	});
});
