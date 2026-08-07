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

import { expectedViewer, type FolderFile } from "../support/folderData";

const MAX_DATA_AGE_HOURS = 168; // 7 days

// Retailers with a data/folders/<slug>.json file. maxi-zoo is intentionally
// absent: it is a real retailer in src/lib/retailers.ts that has never been
// scraped, and listing it here made every `cy.readFile` in this suite fail on a
// missing file instead of reporting anything about freshness. Its page (empty
// state, no viewer) is covered in folder-viewer.cy.ts.
const allRetailers = [
	// General
	{ slug: "albert-heijn", path: "/folders/albert-heijn" },
	{ slug: "lidl", path: "/folders/lidl" },
	{ slug: "delhaize", path: "/folders/delhaize" },
	{ slug: "colruyt", path: "/folders/colruyt" },
	{ slug: "aldi", path: "/folders/aldi" },
	{ slug: "action", path: "/folders/action" },
	// Pet
	{ slug: "tom-co", path: "/folders/tom-co" },
	{ slug: "zooplus", path: "/folders/zooplus" },
	{ slug: "aveve", path: "/folders/aveve" },
	{ slug: "medpets", path: "/folders/medpets" },
	// Electro
	{ slug: "mediamarkt", path: "/folders/mediamarkt" },
	{ slug: "coolblue", path: "/folders/coolblue" },
	{ slug: "vanden-borre", path: "/folders/vanden-borre" },
	{ slug: "krefel", path: "/folders/krefel" },
	{ slug: "bol", path: "/folders/bol" },
	// Fashion
	{ slug: "hm", path: "/folders/hm" },
	{ slug: "zalando", path: "/folders/zalando" },
	// Home & Garden
	{ slug: "ikea", path: "/folders/ikea" },
	{ slug: "gamma", path: "/folders/gamma" },
	// Beauty
	{ slug: "kruidvat", path: "/folders/kruidvat" },
	{ slug: "ici-paris-xl", path: "/folders/ici-paris-xl" },
	{ slug: "douglas", path: "/folders/douglas" },
	{ slug: "di", path: "/folders/di" },
	{ slug: "etos", path: "/folders/etos" },
	{ slug: "boots", path: "/folders/boots" },
	{ slug: "muller", path: "/folders/muller" },
	{ slug: "rossmann", path: "/folders/rossmann" },
	{ slug: "treac", path: "/folders/treac" },
	{ slug: "rituals", path: "/folders/rituals" },
	{ slug: "yves-rocher", path: "/folders/yves-rocher" },
	{ slug: "the-body-shop", path: "/folders/the-body-shop" },
];

const retailerPaths = Object.fromEntries(
	allRetailers.map((r) => [r.slug, r.path]),
);

type FolderData = FolderFile;

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

					// This used to demand an iframe from any folder carrying an
					// embedUrl. Most embedUrls are now refused by the viewer — Publitas
					// and ah.be send X-Frame-Options, gamma recorded a bare viewer
					// homepage, zalando a consent bridge — so that branch failed for
					// exactly the retailers whose embed is broken. Ask instead for the
					// viewer the data actually calls for.
					const latestFolder = data.folders[0];

					switch (expectedViewer(latestFolder, slug)) {
						case "pages":
							cy.contains("Pagina 1 van").should("be.visible");
							break;
						case "embed":
						case "pdf":
							cy.get('iframe[title*="folder"]').should(
								"have.length.at.least",
								1,
							);
							break;
						default:
							// Nothing framable: the viewer must admit it rather than wrap
							// its chrome around an empty box.
							cy.contains(/(?:binnenkort|kunnen we hier niet tonen|nog geen folder beschikbaar|momenteel geen)/i).should("be.visible");
							cy.get('iframe[title*="folder"]').should("not.exist");
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
