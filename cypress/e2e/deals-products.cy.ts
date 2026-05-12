/**
 * Deals / products in promo tests
 *
 * Verifies that scraped deals exist in the data files,
 * have valid structure, and that the site can render them.
 */

const dealRetailers = [
	{ slug: "albert-heijn", name: "Albert Heijn" },
	{ slug: "lidl", name: "Lidl" },
	{ slug: "delhaize", name: "Delhaize" },
	{ slug: "colruyt", name: "Colruyt" },
];

type DealsFile = {
	deals: unknown[];
	folders: unknown[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null;
}

describe("Deals data validation", () => {
	dealRetailers.forEach(({ slug, name }) => {
		describe(`${name} deals`, () => {
			let data: DealsFile;

			before(() => {
				cy.readFile(`data/folders/${slug}.json`).then((json) => {
					data = json as DealsFile;
				});
			});

			it("deals array exists in scraped data", () => {
				expect(data.deals).to.be.an("array");
			});

			it("deals have product name when present", () => {
				if (data.deals.length === 0) return;
				data.deals.forEach((deal: unknown, i: number) => {
					if (!isRecord(deal)) return;
					expect(deal.product, `deal[${i}].product`).to.be.a("string");
					expect(deal.product, `deal[${i}].product not empty`).to.not.equal("");
				});
			});

			it("deals have valid date range when present", () => {
				if (data.deals.length === 0) return;
				data.deals.forEach((deal: unknown, i: number) => {
					if (!isRecord(deal)) return;
					expect(deal.validFrom, `deal[${i}].validFrom`).to.be.a("string");
					expect(deal.validFrom, `deal[${i}].validFrom not empty`).to.not.equal(
						"",
					);
					expect(deal.validUntil, `deal[${i}].validUntil`).to.be.a("string");
					expect(
						deal.validUntil,
						`deal[${i}].validUntil not empty`,
					).to.not.equal("");
				});
			});

			it("deals have correct retailer slug when present", () => {
				if (data.deals.length === 0) return;
				data.deals.forEach((deal: unknown, i: number) => {
					if (!isRecord(deal)) return;
					expect(deal.retailerSlug, `deal[${i}].retailerSlug`).to.equal(slug);
				});
			});

			it("deal prices are non-negative numbers when present", () => {
				if (data.deals.length === 0) return;
				data.deals.forEach((deal: unknown, i: number) => {
					if (!isRecord(deal)) return;
					if (deal.promoPrice !== undefined) {
						expect(deal.promoPrice, `deal[${i}].promoPrice`).to.be.a("number");
						expect(
							deal.promoPrice,
							`deal[${i}].promoPrice >= 0`,
						).to.be.at.least(0);
					}
					if (deal.originalPrice !== undefined) {
						expect(deal.originalPrice, `deal[${i}].originalPrice`).to.be.a(
							"number",
						);
						expect(
							deal.originalPrice,
							`deal[${i}].originalPrice >= 0`,
						).to.be.at.least(0);
					}
				});
			});

			it("promo price is less than or equal to original price when both exist", () => {
				if (data.deals.length === 0) return;
				data.deals.forEach((deal: unknown, i: number) => {
					if (!isRecord(deal)) return;
					if (
						deal.promoPrice !== undefined &&
						deal.originalPrice !== undefined
					) {
						expect(
							deal.promoPrice,
							`deal[${i}] promo <= original`,
						).to.be.at.most(deal.originalPrice);
					}
				});
			});

			it("deal image URLs are valid when present", () => {
				if (data.deals.length === 0) return;
				data.deals.forEach((deal: unknown, i: number) => {
					if (!isRecord(deal)) return;
					if (typeof deal.imageUrl === "string" && deal.imageUrl.length > 0) {
						expect(deal.imageUrl, `deal[${i}].imageUrl`).to.match(
							/^(https?:\/\/|\/)/,
						);
					}
				});
			});

			it("no duplicate deals (same product + price + retailer)", () => {
				if (data.deals.length === 0) return;
				const keys = new Set<string>();
				data.deals.forEach((deal: unknown) => {
					if (!isRecord(deal)) return;
					const product = typeof deal.product === "string" ? deal.product : "";
					const retailerSlug =
						typeof deal.retailerSlug === "string" ? deal.retailerSlug : "";
					const promoPrice = deal.promoPrice;
					const key = `${product.toLowerCase().trim()}-${promoPrice ?? ""}-${retailerSlug}`;
					expect(keys.has(key), `duplicate deal: ${key}`).to.equal(false);
					keys.add(key);
				});
			});
		});
	});
});

describe("Folder-embedded deals (page-level)", () => {
	dealRetailers.forEach(({ slug, name }) => {
		it(`${name}: page-level deals have valid structure`, () => {
			cy.readFile(`data/folders/${slug}.json`).then((data) => {
				(data.folders as unknown[]).forEach((folder: unknown) => {
					if (!isRecord(folder)) return;
					const pages = Array.isArray(folder.pages) ? folder.pages : [];
					pages.forEach((page: unknown, pageIdx: number) => {
						if (!isRecord(page)) return;
						const deals = Array.isArray(page.deals) ? page.deals : [];
						deals.forEach((deal: unknown, dealIdx: number) => {
							if (!isRecord(deal)) return;
							expect(
								deal.product,
								`${slug} page[${pageIdx}].deal[${dealIdx}].product`,
							).to.be.a("string");
							expect(
								deal.product,
								`${slug} page[${pageIdx}].deal[${dealIdx}].product not empty`,
							).to.not.equal("");
							expect(
								deal.retailerSlug,
								`${slug} page[${pageIdx}].deal[${dealIdx}].retailerSlug`,
							).to.equal(slug);
						});
					});
				});
			});
		});
	});
});

describe("Cross-retailer deal consistency", () => {
	it("all retailers follow the same deal schema", () => {
		const requiredFields = [
			"id",
			"product",
			"validFrom",
			"validUntil",
			"retailerSlug",
		];

		dealRetailers.forEach(({ slug }) => {
			cy.readFile(`data/folders/${slug}.json`).then((data) => {
				(data.deals as unknown[]).forEach((deal: unknown, i: number) => {
					if (!isRecord(deal)) return;
					requiredFields.forEach((field) => {
						expect(
							(deal as Record<string, unknown>)[field],
							`${slug} deal[${i}].${field} exists`,
						).to.not.equal(undefined);
					});
				});
			});
		});
	});
});
