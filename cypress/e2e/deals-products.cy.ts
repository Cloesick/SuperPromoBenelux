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

describe("Deals data validation", () => {
  dealRetailers.forEach(({ slug, name }) => {
    describe(`${name} deals`, () => {
      let data: any;

      before(() => {
        cy.readFile(`data/folders/${slug}.json`).then((json) => {
          data = json;
        });
      });

      it("deals array exists in scraped data", () => {
        expect(data.deals).to.be.an("array");
      });

      it("deals have product name when present", () => {
        if (data.deals.length === 0) return;
        data.deals.forEach((deal: any, i: number) => {
          expect(deal.product, `deal[${i}].product`).to.be.a("string").and.not
            .be.empty;
        });
      });

      it("deals have valid date range when present", () => {
        if (data.deals.length === 0) return;
        data.deals.forEach((deal: any, i: number) => {
          expect(deal.validFrom, `deal[${i}].validFrom`).to.be.a("string").and
            .not.be.empty;
          expect(deal.validUntil, `deal[${i}].validUntil`).to.be.a("string").and
            .not.be.empty;
        });
      });

      it("deals have correct retailer slug when present", () => {
        if (data.deals.length === 0) return;
        data.deals.forEach((deal: any, i: number) => {
          expect(deal.retailerSlug, `deal[${i}].retailerSlug`).to.equal(slug);
        });
      });

      it("deal prices are non-negative numbers when present", () => {
        if (data.deals.length === 0) return;
        data.deals.forEach((deal: any, i: number) => {
          if (deal.promoPrice !== undefined) {
            expect(deal.promoPrice, `deal[${i}].promoPrice`).to.be.a("number");
            expect(
              deal.promoPrice,
              `deal[${i}].promoPrice >= 0`
            ).to.be.at.least(0);
          }
          if (deal.originalPrice !== undefined) {
            expect(deal.originalPrice, `deal[${i}].originalPrice`).to.be.a(
              "number"
            );
            expect(
              deal.originalPrice,
              `deal[${i}].originalPrice >= 0`
            ).to.be.at.least(0);
          }
        });
      });

      it("promo price is less than or equal to original price when both exist", () => {
        if (data.deals.length === 0) return;
        data.deals.forEach((deal: any, i: number) => {
          if (
            deal.promoPrice !== undefined &&
            deal.originalPrice !== undefined
          ) {
            expect(
              deal.promoPrice,
              `deal[${i}] promo <= original`
            ).to.be.at.most(deal.originalPrice);
          }
        });
      });

      it("deal image URLs are valid when present", () => {
        if (data.deals.length === 0) return;
        data.deals.forEach((deal: any, i: number) => {
          if (deal.imageUrl) {
            expect(deal.imageUrl, `deal[${i}].imageUrl`).to.match(
              /^(https?:\/\/|\/)/
            );
          }
        });
      });

      it("no duplicate deals (same product + price + retailer)", () => {
        if (data.deals.length === 0) return;
        const keys = new Set<string>();
        data.deals.forEach((deal: any) => {
          const key = `${deal.product.toLowerCase().trim()}-${deal.promoPrice ?? ""}-${deal.retailerSlug}`;
          expect(keys.has(key), `duplicate deal: ${key}`).to.be.false;
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
        data.folders.forEach((folder: any) => {
          folder.pages.forEach((page: any, pageIdx: number) => {
            page.deals.forEach((deal: any, dealIdx: number) => {
              expect(
                deal.product,
                `${slug} page[${pageIdx}].deal[${dealIdx}].product`
              ).to.be.a("string").and.not.be.empty;
              expect(
                deal.retailerSlug,
                `${slug} page[${pageIdx}].deal[${dealIdx}].retailerSlug`
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
        data.deals.forEach((deal: any, i: number) => {
          requiredFields.forEach((field) => {
            expect(
              deal[field],
              `${slug} deal[${i}].${field} exists`
            ).to.not.be.undefined;
          });
        });
      });
    });
  });
});
