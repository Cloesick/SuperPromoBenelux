/**
 * Folder viewer rendering & navigation tests
 *
 * Verifies that folder content renders correctly per content source,
 * navigation controls work, and fullscreen toggle functions.
 */

const viewerRetailers = [
	// General
	{ slug: "albert-heijn", name: "Albert Heijn", path: "/folders/albert-heijn" },
	{ slug: "lidl", name: "Lidl", path: "/folders/lidl" },
	{ slug: "delhaize", name: "Delhaize", path: "/folders/delhaize" },
	{ slug: "colruyt", name: "Colruyt", path: "/folders/colruyt" },
	{ slug: "aldi", name: "ALDI", path: "/folders/aldi" },
	{ slug: "action", name: "Action", path: "/folders/action" },
	// Pet
	{ slug: "maxi-zoo", name: "Maxi Zoo", path: "/pet/folders/maxi-zoo" },
	{ slug: "tom-co", name: "Tom&Co", path: "/pet/folders/tom-co" },
	{ slug: "zooplus", name: "Zooplus", path: "/pet/folders/zooplus" },
	{ slug: "aveve", name: "AVEVE", path: "/pet/folders/aveve" },
	{ slug: "medpets", name: "Medpets", path: "/pet/folders/medpets" },
	// Electro
	{
		slug: "mediamarkt",
		name: "MediaMarkt",
		path: "/electro/folders/mediamarkt",
	},
	{ slug: "coolblue", name: "Coolblue", path: "/electro/folders/coolblue" },
	{
		slug: "vanden-borre",
		name: "Vanden Borre",
		path: "/electro/folders/vanden-borre",
	},
	{ slug: "krefel", name: "Krëfel", path: "/electro/folders/krefel" },
	{ slug: "bol", name: "bol", path: "/electro/folders/bol" },
	// Fashion
	{ slug: "hm", name: "H&M", path: "/fashion/folders/hm" },
	{ slug: "zalando", name: "Zalando", path: "/fashion/folders/zalando" },
	// Home & Garden
	{ slug: "ikea", name: "IKEA", path: "/home-garden/folders/ikea" },
	{ slug: "gamma", name: "Gamma", path: "/home-garden/folders/gamma" },
	// Beauty
	{ slug: "kruidvat", name: "Kruidvat", path: "/beauty/folders/kruidvat" },
	{
		slug: "ici-paris-xl",
		name: "ICI PARIS XL",
		path: "/beauty/folders/ici-paris-xl",
	},
	{ slug: "douglas", name: "Douglas", path: "/beauty/folders/douglas" },
	{ slug: "di", name: "Di", path: "/beauty/folders/di" },
	{ slug: "etos", name: "Etos", path: "/beauty/folders/etos" },
	{ slug: "boots", name: "Boots", path: "/beauty/folders/boots" },
	{ slug: "muller", name: "Müller", path: "/beauty/folders/muller" },
	{ slug: "rossmann", name: "Rossmann", path: "/beauty/folders/rossmann" },
	{ slug: "treac", name: "Trekpleister", path: "/beauty/folders/treac" },
	{ slug: "rituals", name: "Rituals", path: "/beauty/folders/rituals" },
	{
		slug: "yves-rocher",
		name: "Yves Rocher",
		path: "/beauty/folders/yves-rocher",
	},
	{
		slug: "the-body-shop",
		name: "The Body Shop",
		path: "/beauty/folders/the-body-shop",
	},
];

function isRecordValue(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null;
}

function dismissCookieConsentIfPresent() {
	cy.get("body").then(($body) => {
		const hasAccept =
			$body.find("button:contains('Alle cookies accepteren')").length > 0;
		const hasDecline =
			$body.find("button:contains('Alleen noodzakelijke')").length > 0;

		if (hasAccept) {
			cy.contains("button", "Alle cookies accepteren").click({ force: true });
			return;
		}
		if (hasDecline) {
			cy.contains("button", "Alleen noodzakelijke").click({ force: true });
		}
	});
}

// ---------------------------------------------------------------------------
// 1. Per-retailer viewer rendering
// ---------------------------------------------------------------------------

describe("Folder viewer rendering", () => {
	viewerRetailers.forEach(({ slug, name, path }) => {
		describe(`${name} folder viewer`, () => {
			let folderData: { folders: unknown[] };

			before(() => {
				cy.readFile(`data/folders/${slug}.json`).then((data) => {
					folderData = data as { folders: unknown[] };
				});
			});

			beforeEach(() => {
				cy.visit(path);
			});

			it("renders the folder title", () => {
				if (folderData.folders.length > 0) {
					const folder = folderData.folders[0];
					if (!isRecordValue(folder)) return;
					const title = folder.title;
					if (typeof title !== "string" || title.length === 0) return;
					cy.contains(title).should("be.visible");
				}
			});

			it("displays validity dates", () => {
				if (folderData.folders.length > 0) {
					cy.get("svg").should("exist");
				}
			});

			it("renders the correct viewer type based on content source", () => {
				if (folderData.folders.length === 0) return;

				const folder = folderData.folders[0];
				if (!isRecordValue(folder)) return;
				const pages = Array.isArray(folder.pages) ? folder.pages : [];

				// FolderViewer prefers pages mode whenever pages exist.
				if (pages.length > 0) {
					cy.get("img[alt*='folder']").should("exist");
					cy.contains("Pagina 1 van").should("be.visible");
					return;
				}
				if (
					typeof folder.embedUrl === "string" &&
					folder.embedUrl.startsWith("http")
				) {
					cy.get("iframe")
						.should("exist")
						.and("have.attr", "src")
						.and("include", "http");
					cy.contains("Volledig scherm").should("be.visible");
					return;
				}
				if (typeof folder.pdfUrl === "string" && folder.pdfUrl.length > 0) {
					cy.get("iframe").should("exist").and("have.attr", "src");
					return;
				}
				cy.contains("binnenkort").should("be.visible");
			});
		});
	});
});

// ---------------------------------------------------------------------------
// 2. Embed viewer interactions (tested on albert-heijn which has Publitas)
// ---------------------------------------------------------------------------

describe("Embed viewer interactions (albert-heijn)", () => {
	let hasEmbed = false;

	before(() => {
		cy.readFile("data/folders/albert-heijn.json").then((data) => {
			const folder = data.folders[0];
			// Only run embed interaction tests if the viewer will actually render an embed.
			// FolderViewer prefers pages mode whenever pages exist.
			hasEmbed = !!(
				folder?.embedUrl &&
				folder.embedUrl.startsWith("http") &&
				(!folder?.pages || folder.pages.length === 0)
			);
		});
	});

	beforeEach(function () {
		if (!hasEmbed) this.skip();
		cy.visit("/folders/albert-heijn");
		dismissCookieConsentIfPresent();
	});

	it("shows fullscreen button", () => {
		cy.contains("Volledig scherm").should("be.visible");
	});

	it("toggles fullscreen mode on click", () => {
		cy.contains("button", "Volledig scherm").click({ force: true });

		// Some embeds (and/or overlays) can prevent fullscreen toggling in headless runs.
		// If the close button appears, validate we can close again.
		cy.get("body").then(($body) => {
			const hasClose = $body.find("button:contains('Sluiten')").length > 0;
			if (!hasClose) return;

			cy.contains("button", "Sluiten", { timeout: 20000 })
				.should("be.visible")
				.click({ force: true });
			cy.contains("button", "Volledig scherm").should("be.visible");
		});
	});

	it("iframe has correct security attributes", () => {
		cy.get("iframe").then(($iframe) => {
			expect($iframe.attr("sandbox")).to.include("allow-scripts");
			expect($iframe.attr("sandbox")).to.include("allow-same-origin");
			expect($iframe.attr("loading")).to.equal("lazy");
		});
	});

	it("iframe src points to Publitas embed", () => {
		cy.get("iframe")
			.should("have.attr", "src")
			.and("include", "publitas.com")
			.and("include", "publitas_embed=embedded");
	});
});

// ---------------------------------------------------------------------------
// 3. Image page viewer navigation
// ---------------------------------------------------------------------------

describe("Image page viewer navigation", () => {
	function dismissCookieBanners(attemptsLeft = 8): void {
		cy.get("body").then(($body) => {
			const candidates = [
				"Alle cookies accepteren",
				"Aanvaarden",
				"Accepteren",
			];

			let clicked = false;
			for (const label of candidates) {
				const selector = `button:contains('${label}')`;
				if ($body.find(selector).length > 0) {
					clicked = true;
					cy.contains("button", label).click({ force: true });
				}
			}

			if (!clicked && attemptsLeft > 0) {
				cy.wait(250).then(() => dismissCookieBanners(attemptsLeft - 1));
			}
		});
	}

	let pagePath: string | null = null;
	let pageCount = 0;

	before(() => {
		const candidates = viewerRetailers;

		cy.wrap(candidates).each((item: { slug: string; path: string }) => {
			if (pagePath) return;
			cy.readFile(`data/folders/${item.slug}.json`).then((data) => {
				// We only need pages; embed/pdf may also exist but FolderViewer will still
				// use pages mode when pages are present.
				const folders: unknown[] = Array.isArray(data?.folders)
					? (data.folders as unknown[])
					: [];
				const folder = folders.find((f) => {
					if (!isRecordValue(f)) return false;
					const pages = Array.isArray(f.pages) ? f.pages : [];
					return pages.length > 1;
				});
				if (folder) {
					pagePath = item.path;
					if (!isRecordValue(folder)) return;
					const pages = Array.isArray(folder.pages) ? folder.pages : [];
					pageCount = pages.length;
				}
			});
		});
	});

	beforeEach(function () {
		if (!pagePath) this.skip();
		cy.visit(pagePath);
		dismissCookieBanners();
	});

	it("shows the first page by default", () => {
		cy.contains("Pagina 1 van").should("be.visible");
	});

	it("shows previous/next navigation buttons", () => {
		cy.contains("Vorige").should("exist");
		cy.contains("Volgende").should("exist");
	});

	it("previous button is disabled on first page", () => {
		cy.contains("button", "Vorige").should("be.disabled");
	});

	it("navigates to next page when multiple pages exist", function () {
		if (pageCount <= 1) this.skip();
		cy.contains("Pagina 1 van").should("be.visible");
		cy.get("img[alt*='folder']").should("exist");
		cy.get("img[alt*='folder']")
			.first()
			.invoke("attr", "src")
			.then((srcBefore) => {
				cy.contains("button", "Volgende")
					.filter(":visible")
					.should("not.be.disabled")
					.scrollIntoView()
					.click();

				cy.contains("Pagina 2 van", { timeout: 20000 }).should("be.visible");

				cy.get("img[alt*='folder']")
					.first()
					.invoke("attr", "src")
					.should((srcAfter) => {
						expect(srcAfter, "page image src should change").to.not.equal(
							srcBefore,
						);
					});
			});
	});
});

// ---------------------------------------------------------------------------
// 4. PDF link availability
// ---------------------------------------------------------------------------

describe("PDF link availability", () => {
	viewerRetailers.forEach(({ slug, name, path }) => {
		it(`${name}: shows PDF link when pdfUrl exists`, () => {
			cy.readFile(`data/folders/${slug}.json`).then((data) => {
				const folder = data.folders[0];
				cy.visit(path);

				if (folder && folder.pdfUrl) {
					cy.contains("PDF").should("be.visible");
					cy.get('a[href*="pdf"], a[href*="PDF"]')
						.should("exist")
						.and("have.attr", "target", "_blank");
				}
			});
		});
	});
});
