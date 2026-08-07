/**
 * Folder viewer rendering & navigation tests
 *
 * Verifies that FolderViewer picks the right viewer for the content it is given,
 * that page navigation works, and that content the app deliberately refuses to
 * frame never reaches the DOM as an iframe.
 *
 * Rewritten after the suite went red on two counts:
 *
 *   1. It asserted `iframe[src*="publitas.com"]` for albert-heijn. Publitas
 *      serves X-Frame-Options, so that iframe was always a blank white box;
 *      src/lib/folderRenderability.ts now blocks the host and the viewer falls
 *      back to page images, a framable PDF, or an honest placeholder. The spec
 *      was asserting the bug.
 *   2. It looped over `maxi-zoo`, whose data/folders/maxi-zoo.json does not
 *      exist, so `cy.readFile` failed the whole file before anything ran. The
 *      retailer still exists in src/lib/retailers.ts, so the interesting
 *      assertion is the no-data empty state — see the last describe block.
 */

import {
	expectedViewer,
	isEmbedBlocked,
	isPdfForcedDownload,
	type FolderFile,
	type FolderPage,
	type ScrapedFolder,
} from "../support/folderData";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seed the cookie choice instead of clicking the banner away.
 *
 * The old spec chased the banner with a retrying `dismissCookieBanners()` that
 * cost two seconds per visit on pages where it never appears, and the banner is
 * `fixed bottom-0 z-100` — it sat on top of the "Volgende" button and made page
 * navigation clicks flake. Declining also keeps FolderViewer from firing
 * /api/engagement beacons for every page turn (it only tracks with consent).
 */
function visitViewer(path: string) {
	cy.visit(path, {
		onBeforeLoad(win) {
			win.localStorage.setItem("sp_cookie_consent", "declined");
		},
	});
}

/**
 * Click a control and retry until the page reflects it.
 *
 * FolderViewer is a client component: the server sends fully-rendered markup,
 * so the button is present and enabled before React has attached its handler.
 * A click that lands in that window is silently a no-op — Cypress reports it as
 * a success and the assertion that follows fails. That made the navigation
 * tests flaky rather than failing, which is worse: Colruyt passed one run and
 * failed the next with no change in between.
 *
 * Cypress retries assertions but never actions, so the retry has to be here.
 */
function retryClick(
	click: () => void,
	expected: string | RegExp,
	tries = 6,
): void {
	const matches = (text: string) =>
		expected instanceof RegExp ? expected.test(text) : text.includes(expected);

	const attempt = (remaining: number) => {
		click();
		cy.get("body").then(($body) => {
			if (matches($body.text()) || remaining <= 0) return;
			cy.wait(250);
			attempt(remaining - 1);
		});
	};

	attempt(tries);
}

function clickUntil(buttonText: string, expected: string | RegExp, tries = 6) {
	retryClick(
		() => cy.contains("button", buttonText).should("not.be.disabled").click(),
		expected,
		tries,
	);
}

/** Same retry, for the thumbnail strip, which is images rather than buttons. */
function clickThumbnailUntil(alt: string, expected: string | RegExp, tries = 6) {
	// force: the strip scrolls horizontally and its own scroll arrows are
	// absolutely positioned over the first and last thumbnails.
	retryClick(() => cy.get(`img[alt="${alt}"]`).click({ force: true }), expected, tries);
}

function readFolder(slug: string): Cypress.Chainable<ScrapedFolder> {
	return cy
		.readFile(`data/folders/${slug}.json`)
		.then((data: FolderFile) => data.folders[0]);
}

/** The viewer's own iframes, by title — ad iframes must not satisfy these. */
function embedFrame(name: string) {
	return `iframe[title="${name} folder"]`;
}

function pdfFrame(name: string) {
	return `iframe[title="${name} folder PDF"]`;
}

// ---------------------------------------------------------------------------
// 1. Page-image viewer
//
// The page counts move with every scrape (at the time of writing: colruyt 10,
// action 18, delhaize 5), so the expected count is read from the data file. Only
// a floor is hard-coded, because a scrape that quietly degrades to one page is a
// regression the counter assertion would otherwise happily accept.
// ---------------------------------------------------------------------------

const pageImageRetailers = [
	{ slug: "colruyt", name: "Colruyt", path: "/folders/colruyt", minPages: 5 },
	{ slug: "action", name: "Action", path: "/folders/action", minPages: 5 },
	{
		slug: "delhaize",
		name: "Delhaize",
		path: "/folders/delhaize",
		minPages: 3,
	},
];

describe("Page-image folder viewer", () => {
	pageImageRetailers.forEach(({ slug, name, path, minPages }) => {
		describe(`${name}`, () => {
			let folder: ScrapedFolder;
			let pages: FolderPage[];

			before(() => {
				readFolder(slug).then((f) => {
					folder = f;
					pages = f.pages ?? [];
				});
			});

			beforeEach(() => {
				visitViewer(path);
			});

			it("has enough scraped pages to be worth showing", () => {
				expect(pages.length, `${slug} page count`).to.be.at.least(minPages);
			});

			it("renders the folder title and a validity range", () => {
				cy.contains("h2", folder.title).should("be.visible");
				// The dates are formatted with toLocaleDateString("nl-BE"), so assert
				// the shape rather than an exact string — the runner's timezone can
				// shift a UTC-midnight date by a day.
				cy.contains(/\d{1,2} \w+ \d{4} - \d{1,2} \w+ \d{4}/).should(
					"be.visible",
				);
			});

			it("opens on page 1 and counts every scraped page", () => {
				cy.contains(`Pagina 1 van ${pages.length}`).should("be.visible");
			});

			it("actually loads the page 1 image, not just an <img> tag", () => {
				// A 404 here would make FolderViewer drop pages mode entirely, so the
				// counter above already implies the image resolved — but naturalWidth
				// is the assertion that catches a public/screenshots deploy gap
				// directly instead of via a confusing counter failure.
				// Both checks run against the element itself. Chaining .and() after
				// .should("have.attr", ...) would replace the subject with the
				// attribute string, leaving naturalWidth undefined.
				cy.get(`img[alt="${name} folder pagina 1"]`).should(($img) => {
					// next/image resolves src to an absolute URL, so compare by
					// containment rather than equality.
					expect($img.attr("src"), "points at the scraped page image").to.include(
						pages[0].imageUrl,
					);
					expect(
						($img[0] as HTMLImageElement).naturalWidth,
						"page image is decoded",
					).to.be.greaterThan(0);
				});
			});

			it("disables Vorige on the first page", () => {
				cy.contains("button", "Vorige").should("be.disabled");
			});

			it("navigates forward and back with the Vorige/Volgende buttons", () => {
				clickUntil("Volgende", `Pagina 2 van ${pages.length}`);

				cy.contains(`Pagina 2 van ${pages.length}`).should("be.visible");
				cy.get(`img[alt="${name} folder pagina 2"]`)
					.should("have.attr", "src")
					.and("include", pages[1].imageUrl);

				clickUntil("Vorige", `Pagina 1 van ${pages.length}`);
				cy.contains(`Pagina 1 van ${pages.length}`).should("be.visible");
			});

			it("jumps to a page from the thumbnail strip", () => {
				clickThumbnailUntil("Pagina 3", `Pagina 3 van ${pages.length}`);
				cy.contains(`Pagina 3 van ${pages.length}`).should("be.visible");
				cy.get(`img[alt="${name} folder pagina 3"]`).should("exist");
			});

			it("disables Volgende on the last page", () => {
				clickThumbnailUntil(
					`Pagina ${pages.length}`,
					`Pagina ${pages.length} van ${pages.length}`,
				);
				cy.contains(`Pagina ${pages.length} van ${pages.length}`).should(
					"be.visible",
				);
				cy.contains("button", "Volgende").should("be.disabled");
			});
		});
	});
});

// ---------------------------------------------------------------------------
// 2. Blocked embeds
//
// This is the section the old "iframe src points to Publitas embed" test got
// backwards. None of these embedUrls may ever reach the DOM: the host refuses
// framing, or the URL is not a leaflet at all. What the visitor gets instead is
// page images when the scraper captured them, and an honest placeholder when it
// did not — never viewer chrome wrapped around a blank iframe.
// ---------------------------------------------------------------------------

const blockedEmbedRetailers = [
	{
		slug: "albert-heijn",
		name: "Albert Heijn",
		path: "/folders/albert-heijn",
		reason: "view.publitas.com sends X-Frame-Options",
	},
	{
		slug: "delhaize",
		name: "Delhaize",
		path: "/folders/delhaize",
		reason:
			"delhaize is blocked wholesale, and it has page images to fall back on",
	},
	{
		slug: "gamma",
		name: "Gamma",
		path: "/folders/gamma",
		reason: "folder.gamma.be is the bare viewer homepage, not a leaflet",
	},
	{
		slug: "zalando",
		name: "Zalando",
		path: "/folders/zalando",
		reason: "the embedUrl is a Usercentrics consent bridge",
	},
];

describe("Blocked embeds are never framed", () => {
	blockedEmbedRetailers.forEach(({ slug, name, path, reason }) => {
		describe(`${name} (${reason})`, () => {
			let folder: ScrapedFolder;

			before(() => {
				readFolder(slug).then((f) => {
					folder = f;
				});
			});

			beforeEach(() => {
				visitViewer(path);
			});

			it("never carries an embed the viewer would frame", () => {
				// Asserting the embedUrl is present made this fail on an ordinary
				// re-scrape: once albert-heijn and delhaize started yielding page
				// images the scraper stopped recording an embed at all, which is a
				// perfectly good outcome. The property worth protecting is that
				// nothing framable ever reaches the viewer for these retailers —
				// true whether the embed is blocked or simply absent.
				if (folder.embedUrl) {
					expect(
						isEmbedBlocked(folder.embedUrl, slug),
						`${slug} embed is blocked`,
					).to.equal(true);
				}
			});

			it("renders no embed iframe and no Online switch", () => {
				cy.get(embedFrame(name)).should("not.exist");
				cy.contains("button", "Online").should("not.exist");
			});

			it("falls back to page images, or says so when there are none", () => {
				const pages = folder.pages ?? [];

				if (pages.length > 0) {
					cy.contains(`Pagina 1 van ${pages.length}`).should("be.visible");
					cy.get(`img[alt="${name} folder pagina 1"]`)
						.should("have.attr", "src")
						.and("include", pages[0].imageUrl);
					return;
				}

				// No pages and no framable PDF: the placeholder copy ("worden
				// one of the honest empty states: "kunnen we hier niet tonen" when a
				// folder exists but cannot be framed, "nog geen folder beschikbaar"
				// when there is none, or the expired card once validUntil passes.
				cy.contains(/(?:binnenkort|kunnen we hier niet tonen|nog geen folder beschikbaar|momenteel geen)/i).should("be.visible");
				cy.get('iframe[title*="folder"]').should("not.exist");
			});
		});
	});
});

// ---------------------------------------------------------------------------
// 3. Embeds that can still be framed
//
// folder.kruidvat.be / folder.trekpleister.nl run the same viewer platform as
// the blocked gamma URL but link a specific leaflet, so they are the surviving
// happy path for the embed viewer that Publitas used to cover.
// ---------------------------------------------------------------------------

const framableEmbedRetailers = [
	{ slug: "kruidvat", name: "Kruidvat", path: "/folders/kruidvat" },
	{ slug: "treac", name: "Trekpleister", path: "/folders/treac" },
];

describe("Framable embed viewer", () => {
	framableEmbedRetailers.forEach(({ slug, name, path }) => {
		describe(`${name}`, () => {
			let folder: ScrapedFolder;
			let usesEmbed = false;

			before(() => {
				readFolder(slug).then((f) => {
					folder = f;
					usesEmbed = expectedViewer(f, slug) === "embed";
				});
			});

			beforeEach(function () {
				// Page images win over any embed. If a later scrape captures them for
				// this retailer the embed viewer is simply not what renders, and
				// asserting it would be a false failure rather than a regression.
				if (!usesEmbed) this.skip();
				visitViewer(path);
			});

			it("frames the scraped embedUrl", () => {
				cy.get(embedFrame(name))
					.should("exist")
					.and("have.attr", "src")
					.and("include", folder.embedUrl);
			});

			it("keeps the iframe sandboxed and lazy", () => {
				cy.get(embedFrame(name)).then(($iframe) => {
					const sandbox = $iframe.attr("sandbox") ?? "";
					expect(sandbox).to.include("allow-scripts");
					expect(sandbox).to.include("allow-same-origin");
					expect($iframe.attr("loading")).to.equal("lazy");
				});
			});

			it("offers the embed in a new tab as well", () => {
				cy.contains("a", "Open in nieuw tabblad")
					.should("have.attr", "href", folder.embedUrl)
					.and("have.attr", "target", "_blank");
			});

			it("toggles fullscreen and back", () => {
				// Pure local state in FolderViewer — no cross-origin content involved,
				// so this can be asserted outright instead of the old "if the close
				// button happens to be there" hedge.
				cy.contains("button", "Volledig scherm").click();
				cy.contains("button", "Sluiten").should("be.visible").click();
				cy.contains("button", "Volledig scherm").should("be.visible");
			});
		});
	});
});

// ---------------------------------------------------------------------------
// 4. PDFs
//
// A signed URL carrying response-content-disposition=attachment cannot be shown
// in an iframe — the visitor gets a grey box. The viewer refuses to frame those,
// but keeps the download link, so both halves are asserted.
// ---------------------------------------------------------------------------

const attachmentPdfRetailers = [
	{ slug: "albert-heijn", name: "Albert Heijn", path: "/folders/albert-heijn" },
	{ slug: "lidl", name: "Lidl", path: "/folders/lidl" },
	{ slug: "gamma", name: "Gamma", path: "/folders/gamma" },
	{ slug: "kruidvat", name: "Kruidvat", path: "/folders/kruidvat" },
];

describe("Attachment PDFs stay downloadable but are never framed", () => {
	attachmentPdfRetailers.forEach(({ slug, name, path }) => {
		it(`${name}: download link without a PDF iframe`, () => {
			readFolder(slug).then((folder) => {
				expect(
					isPdfForcedDownload(folder.pdfUrl),
					`${slug}.pdfUrl is attachment-disposition`,
				).to.equal(true);

				visitViewer(path);

				// By href rather than by link text: an embed viewer also renders a
				// mobile-only "Download PDF" link to the same file, and matching on
				// the word "PDF" alone would pick whichever came first.
				cy.get(`a[href="${folder.pdfUrl}"]`)
					.first()
					.should("contain.text", "PDF")
					.and("have.attr", "target", "_blank");
				cy.get(pdfFrame(name)).should("not.exist");
				cy.contains("button", "PDF").should("not.exist");
			});
		});
	});
});

const framablePdfRetailers = [
	{ slug: "coolblue", name: "Coolblue", path: "/folders/coolblue" },
	{
		slug: "vanden-borre",
		name: "Vanden Borre",
		path: "/folders/vanden-borre",
	},
];

describe("Framable PDF viewer", () => {
	framablePdfRetailers.forEach(({ slug, name, path }) => {
		describe(`${name}`, () => {
			let folder: ScrapedFolder;
			let usesPdf = false;

			before(() => {
				readFolder(slug).then((f) => {
					folder = f;
					usesPdf = expectedViewer(f, slug) === "pdf";
				});
			});

			beforeEach(function () {
				// Pages and a framable embed both outrank the PDF viewer, so a later
				// scrape finding either makes this the wrong retailer to assert on.
				if (!usesPdf) this.skip();
				visitViewer(path);
			});

			it("frames the scraped pdfUrl", () => {
				cy.get(pdfFrame(name))
					.should("exist")
					.and("have.attr", "src")
					.and("include", folder.pdfUrl);
			});

			it("offers the same PDF as a direct link", () => {
				cy.contains("a", "Open PDF")
					.should("have.attr", "href", folder.pdfUrl)
					.and("have.attr", "target", "_blank");
			});
		});
	});
});

// ---------------------------------------------------------------------------
// 5. Thumbnail strip
//
// The strip renders next/image with `unoptimized`, so whatever `src` points at
// is downloaded at full resolution to fill a 64x88 box. Serving the full page
// scans there meant a 10-page colruyt folder pulled ~10 full-size webp files
// before the visitor turned a single page; the scraper now writes a `-thumb`
// variant per page and the strip must use it. Pages scraped before thumbnails
// existed have no thumbnailUrl and still fall back to the full image.
// ---------------------------------------------------------------------------

describe("Thumbnail strip uses the small images", () => {
	it("colruyt: every scraped page carries a thumbnailUrl", () => {
		readFolder("colruyt").then((folder) => {
			const pages = folder.pages ?? [];
			expect(pages.length, "colruyt pages").to.be.greaterThan(1);
			pages.forEach((page, i) => {
				expect(page.thumbnailUrl, `colruyt page[${i}].thumbnailUrl`).to.be.a(
					"string",
				);
			});
		});
	});

	it("colruyt: the strip requests -thumb files, not the full page scans", () => {
		readFolder("colruyt").then((folder) => {
			const pages = folder.pages ?? [];
			visitViewer("/folders/colruyt");

			cy.get('img[alt^="Pagina "]').should("have.length", pages.length);

			pages.forEach((page, i) => {
				cy.get(`img[alt="Pagina ${i + 1}"]`)
					.should("have.attr", "src")
					.and("include", page.thumbnailUrl)
					.and("not.include", `${page.imageUrl}"`);
			});
		});
	});

	it("douglas: pages without a thumbnailUrl fall back to the full image", () => {
		readFolder("douglas").then((folder) => {
			const pages = folder.pages ?? [];
			expect(pages.length, "douglas pages").to.be.greaterThan(1);

			visitViewer("/folders/douglas");

			// Data-driven rather than hard-coded: whichever pages have thumbnails by
			// the time this runs must use them, and the rest must still render.
			pages.slice(0, 5).forEach((page, i) => {
				cy.get(`img[alt="Pagina ${i + 1}"]`).should(
					"have.attr",
					"src",
					page.thumbnailUrl ?? page.imageUrl,
				);
			});
		});
	});
});

// ---------------------------------------------------------------------------
// 6. Every retailer lands in exactly one viewer
//
// Replaces the old 32-retailer sweep, which asserted an iframe for any folder
// carrying an embedUrl and so demanded the blank Publitas box. maxi-zoo is not
// in this list because it has no data file at all; that case is covered below.
// ---------------------------------------------------------------------------

const viewerRetailers = [
	{ slug: "albert-heijn", name: "Albert Heijn", path: "/folders/albert-heijn" },
	{ slug: "lidl", name: "Lidl", path: "/folders/lidl" },
	{ slug: "delhaize", name: "Delhaize", path: "/folders/delhaize" },
	{ slug: "colruyt", name: "Colruyt", path: "/folders/colruyt" },
	{ slug: "aldi", name: "ALDI", path: "/folders/aldi" },
	{ slug: "action", name: "Action", path: "/folders/action" },
	{ slug: "tom-co", name: "Tom&Co", path: "/folders/tom-co" },
	{ slug: "zooplus", name: "Zooplus", path: "/folders/zooplus" },
	{ slug: "aveve", name: "AVEVE", path: "/folders/aveve" },
	{ slug: "medpets", name: "Medpets", path: "/folders/medpets" },
	{
		slug: "mediamarkt",
		name: "MediaMarkt",
		path: "/folders/mediamarkt",
	},
	{ slug: "coolblue", name: "Coolblue", path: "/folders/coolblue" },
	{
		slug: "vanden-borre",
		name: "Vanden Borre",
		path: "/folders/vanden-borre",
	},
	{ slug: "krefel", name: "Krëfel", path: "/folders/krefel" },
	{ slug: "bol", name: "bol", path: "/folders/bol" },
	{ slug: "hm", name: "H&M", path: "/folders/hm" },
	{ slug: "zalando", name: "Zalando", path: "/folders/zalando" },
	{ slug: "ikea", name: "IKEA", path: "/folders/ikea" },
	{ slug: "gamma", name: "Gamma", path: "/folders/gamma" },
	{ slug: "kruidvat", name: "Kruidvat", path: "/folders/kruidvat" },
	{
		slug: "ici-paris-xl",
		name: "ICI PARIS XL",
		path: "/folders/ici-paris-xl",
	},
	{ slug: "douglas", name: "Douglas", path: "/folders/douglas" },
	{ slug: "di", name: "Di", path: "/folders/di" },
	{ slug: "etos", name: "Etos", path: "/folders/etos" },
	{ slug: "boots", name: "Boots", path: "/folders/boots" },
	{ slug: "muller", name: "Müller", path: "/folders/muller" },
	{ slug: "rossmann", name: "Rossmann", path: "/folders/rossmann" },
	{ slug: "treac", name: "Trekpleister", path: "/folders/treac" },
	{ slug: "rituals", name: "Rituals", path: "/folders/rituals" },
	{
		slug: "yves-rocher",
		name: "Yves Rocher",
		path: "/folders/yves-rocher",
	},
	{
		slug: "the-body-shop",
		name: "The Body Shop",
		path: "/folders/the-body-shop",
	},
];

describe("Viewer selection per retailer", () => {
	viewerRetailers.forEach(({ slug, name, path }) => {
		it(`${name}: renders the viewer its data calls for`, () => {
			readFolder(slug).then((folder) => {
				const pages = folder.pages ?? [];
				const viewer = expectedViewer(folder, slug);

				visitViewer(path);

				if (viewer === "pages") {
					cy.contains(`Pagina 1 van ${pages.length}`).should("be.visible");
					cy.get(`img[alt="${name} folder pagina 1"]`)
						.should("have.attr", "src")
						.and("include", pages[0].imageUrl);
					return;
				}

				if (viewer === "embed") {
					cy.get(embedFrame(name))
						.should("exist")
						.and("have.attr", "src")
					.and("include", folder.embedUrl);
					return;
				}

				if (viewer === "pdf") {
					cy.get(pdfFrame(name))
						.should("exist")
						.and("have.attr", "src")
					.and("include", folder.pdfUrl);
					return;
				}

				// Nothing renderable: the viewer must say so rather than show empty
				// chrome, and must not have framed the content it just rejected.
				cy.contains(/(?:binnenkort|kunnen we hier niet tonen|nog geen folder beschikbaar|momenteel geen)/i).should("be.visible");
				cy.get('iframe[title*="folder"]').should("not.exist");
				cy.contains("Pagina 1 van").should("not.exist");
			});
		});
	});
});

// ---------------------------------------------------------------------------
// 7. Retailer without scraped data
//
// maxi-zoo is a real retailer in src/lib/retailers.ts with no
// data/folders/maxi-zoo.json, which is what broke the previous version of this
// file. The page still has to be serviceable.
// ---------------------------------------------------------------------------

describe("Retailer with no scraped folder (maxi-zoo)", () => {
	beforeEach(() => {
		visitViewer("/folders/maxi-zoo");
	});

	it("renders the retailer page rather than a 404", () => {
		cy.get("h1").should("contain.text", "Maxi Zoo folder");
	});

	it("shows the no-folder notice instead of an empty viewer", () => {
		// The vertical route and the main route word this differently — "geen
		// actieve folder" vs "geen folder" — so match what both actually say
		// rather than pinning one page's copy onto the other.
		cy.contains(/geen (?:actieve )?folder beschikbaar/i).should("be.visible");
		cy.get('iframe[title*="folder"]').should("not.exist");
		cy.contains("Pagina 1 van").should("not.exist");
	});
});
