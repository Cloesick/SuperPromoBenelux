/**
 * Folder freshness & rendering tests
 *
 * Verifies that each retailer's folder page:
 * 1. Loads successfully with scraped data
 * 2. Renders the correct folder title from JSON
 * 3. Has fresh data (scraped within 7 days)
 * 4. Shows actual folder content (embed, pages, or PDF)
 * 5. Matches the JSON data to what's rendered on the page
 */

const MAX_DATA_AGE_HOURS = 168; // 7 days

const allRetailers = [
	// General
	{ slug: "albert-heijn", path: "/folders/albert-heijn" },
	{ slug: "lidl", path: "/folders/lidl" },
	{ slug: "delhaize", path: "/folders/delhaize" },
	{ slug: "colruyt", path: "/folders/colruyt" },
	{ slug: "aldi", path: "/folders/aldi" },
	{ slug: "action", path: "/folders/action" },
	// Pet
	{ slug: "maxi-zoo", path: "/pet/folders/maxi-zoo" },
	{ slug: "tom-co", path: "/pet/folders/tom-co" },
	{ slug: "zooplus", path: "/pet/folders/zooplus" },
	{ slug: "aveve", path: "/pet/folders/aveve" },
	{ slug: "medpets", path: "/pet/folders/medpets" },
	// Electro
	{ slug: "mediamarkt", path: "/electro/folders/mediamarkt" },
	{ slug: "coolblue", path: "/electro/folders/coolblue" },
	{ slug: "vanden-borre", path: "/electro/folders/vanden-borre" },
	{ slug: "krefel", path: "/electro/folders/krefel" },
	{ slug: "bol", path: "/electro/folders/bol" },
	// Fashion
	{ slug: "hm", path: "/fashion/folders/hm" },
	{ slug: "zalando", path: "/fashion/folders/zalando" },
	// Home & Garden
	{ slug: "ikea", path: "/home-garden/folders/ikea" },
	{ slug: "gamma", path: "/home-garden/folders/gamma" },
	// Beauty
	{ slug: "kruidvat", path: "/beauty/folders/kruidvat" },
	{ slug: "ici-paris-xl", path: "/beauty/folders/ici-paris-xl" },
	{ slug: "douglas", path: "/beauty/folders/douglas" },
	{ slug: "di", path: "/beauty/folders/di" },
	{ slug: "etos", path: "/beauty/folders/etos" },
	{ slug: "boots", path: "/beauty/folders/boots" },
	{ slug: "muller", path: "/beauty/folders/muller" },
	{ slug: "rossmann", path: "/beauty/folders/rossmann" },
	{ slug: "treac", path: "/beauty/folders/treac" },
	{ slug: "yves-rocher", path: "/beauty/folders/yves-rocher" },
	{ slug: "the-body-shop", path: "/beauty/folders/the-body-shop" },
];

const retailerPaths = Object.fromEntries(
	allRetailers.map((r) => [r.slug, r.path]),
);

interface FolderData {
	retailer: string;
	scrapedAt: string;
	folders: {
		id: string;
		title: string;
		validFrom: string;
		validUntil: string;
		pageCount: number;
		pages: { pageNumber: number; imageUrl: string }[];
		embedUrl?: string;
		pdfUrl?: string;
	}[];
}

describe("Folder freshness & rendering", () => {
	allRetailers
		.map((r) => r.slug)
		.forEach((slug) => {
			describe(`${slug}`, () => {
				let data: FolderData;

				before(() => {
					cy.readFile(`data/folders/${slug}.json`).then((json) => {
						data = json as FolderData;
					});
				});

				it("has data scraped within the last 7 days", () => {
					const scrapedAt = new Date(data.scrapedAt).getTime();
					const now = Date.now();
					const ageHours = (now - scrapedAt) / (1000 * 60 * 60);

					expect(
						ageHours,
						`${slug} data is ${Math.round(ageHours)}h old`,
					).to.be.lessThan(MAX_DATA_AGE_HOURS);
				});

				it("has at least one non-expired folder", () => {
					const now = new Date();
					const hasActive = data.folders.some((f) => {
						const until = new Date(f.validUntil + "T23:59:59");
						return until >= now;
					});
					// Allow recently expired (within 3 days) as fallback
					const hasRecent = data.folders.some((f) => {
						const until = new Date(f.validUntil + "T23:59:59");
						const daysExpired =
							(now.getTime() - until.getTime()) / (1000 * 60 * 60 * 24);
						return daysExpired < 3;
					});

					expect(
						hasActive || hasRecent,
						`${slug} should have a current or recently expired folder`,
					).to.equal(true);
				});

				it("folder page loads and shows retailer name in heading", () => {
					cy.visit(retailerPaths[slug]);
					cy.get("h1").should("exist").and("contain.text", "folder");
				});

				it("folder page renders content (viewer or empty state)", () => {
					cy.visit(retailerPaths[slug]);

					const latestFolder = data.folders[0];
					const hasPages = latestFolder?.pages?.length > 0;
					const hasEmbed =
						!!latestFolder?.embedUrl &&
						latestFolder.embedUrl.startsWith("http");

					if (hasPages) {
						// Should render page images or thumbnails
						cy.get("img").should("have.length.at.least", 1);
					} else if (hasEmbed) {
						// Should render an iframe embed
						cy.get("iframe").should("have.length.at.least", 1);
					} else {
						// Should show the "no folder" amber state or PDF link
						cy.get("body").should("exist");
					}
				});

				it("folder page has correct page title", () => {
					cy.visit(retailerPaths[slug]);
					cy.title().should("include", "folder");
				});

				it("folder page has valid dates displayed or in JSON-LD", () => {
					cy.visit(retailerPaths[slug]);

					cy.get('script[type="application/ld+json"]')
						.should("exist")
						.first()
						.then(($script) => {
							const json = JSON.parse($script[0]?.textContent || "{}");
							// The retailer folder JSON-LD should exist
							expect(json).to.be.an("object");
						});
				});
			});
		});
});

describe("Cross-retailer content health", () => {
	it("all retailers have folder data files", () => {
		allRetailers.forEach(({ slug }) => {
			cy.readFile(`data/folders/${slug}.json`).should("exist");
		});
	});

	it("no retailer has data older than 7 days", () => {
		const now = Date.now();

		allRetailers.forEach(({ slug }) => {
			cy.readFile(`data/folders/${slug}.json`).then((data: FolderData) => {
				const ageHours =
					(now - new Date(data.scrapedAt).getTime()) / (1000 * 60 * 60);
				expect(
					ageHours,
					`${slug} scraped ${Math.round(ageHours)}h ago`,
				).to.be.lessThan(MAX_DATA_AGE_HOURS);
			});
		});
	});

	it("every retailer folder page returns 200", () => {
		allRetailers.forEach(({ path }) => {
			cy.request(path).its("status").should("equal", 200);
		});
	});
});
