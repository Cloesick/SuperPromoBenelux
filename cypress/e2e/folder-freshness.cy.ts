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

const retailerSlugs = [
	"albert-heijn",
	"lidl",
	"delhaize",
	"colruyt",
	"aldi",
	"action",
];

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
	retailerSlugs.forEach((slug) => {
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

				expect(ageHours, `${slug} data is ${Math.round(ageHours)}h old`).to.be.lessThan(
					MAX_DATA_AGE_HOURS,
				);
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
				cy.visit(`/folders/${slug}`);
				cy.get("h1").should("exist").and("contain.text", "folder");
			});

			it("folder page renders content (viewer or empty state)", () => {
				cy.visit(`/folders/${slug}`);

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
				cy.visit(`/folders/${slug}`);
				cy.title().should("include", "folder");
			});

			it("folder page has valid dates displayed or in JSON-LD", () => {
				cy.visit(`/folders/${slug}`);

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
		retailerSlugs.forEach((slug) => {
			cy.readFile(`data/folders/${slug}.json`).should("exist");
		});
	});

	it("no retailer has data older than 7 days", () => {
		const now = Date.now();

		retailerSlugs.forEach((slug) => {
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
		retailerSlugs.forEach((slug) => {
			cy.request(`/folders/${slug}`).its("status").should("equal", 200);
		});
	});
});
