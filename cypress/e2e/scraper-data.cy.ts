/**
 * Scraper data validation tests
 *
 * Verifies that scraped JSON files exist, have valid structure,
 * and contain the required content for each retailer.
 */

const retailerSlugs = ["albert-heijn", "lidl", "delhaize", "colruyt", "aldi", "action"];

const validContentSources = [
  "publitas",
  "ipaper",
  "yumpu",
  "issuu",
  "pdf",
  "html",
  "screenshot",
  "api",
  "unknown",
];

describe("Scraped data files", () => {
  retailerSlugs.forEach((slug) => {
    describe(`${slug}.json`, () => {
      let data: any;

      before(() => {
        cy.readFile(`data/folders/${slug}.json`).then((json) => {
          data = json;
        });
      });

      it("exists and is valid JSON", () => {
        expect(data).to.not.be.undefined;
        expect(data).to.be.an("object");
      });

      it("has the correct retailer slug", () => {
        expect(data.retailer).to.equal(slug);
      });

      it("has a scrapedAt timestamp", () => {
        expect(data.scrapedAt).to.be.a("string");
        expect(new Date(data.scrapedAt).getTime()).to.not.be.NaN;
      });

      it("has a folders array with at least one folder", () => {
        expect(data.folders).to.be.an("array");
        expect(data.folders.length).to.be.at.least(1);
      });

      it("has a deals array", () => {
        expect(data.deals).to.be.an("array");
      });

      it("has sourceUrls array", () => {
        expect(data.sourceUrls).to.be.an("array");
        expect(data.sourceUrls.length).to.be.at.least(1);
      });

      it("has methods array", () => {
        expect(data.methods).to.be.an("array");
      });

      describe("folder structure", () => {
        it("each folder has required fields", () => {
          data.folders.forEach((folder: any, i: number) => {
            expect(folder.id, `folder[${i}].id`).to.be.a("string").and.not.be
              .empty;
            expect(
              folder.retailerSlug,
              `folder[${i}].retailerSlug`
            ).to.equal(slug);
            expect(folder.title, `folder[${i}].title`).to.be.a("string").and
              .not.be.empty;
            expect(folder.validFrom, `folder[${i}].validFrom`).to.match(
              /^\d{4}-\d{2}-\d{2}$/
            );
            expect(folder.validUntil, `folder[${i}].validUntil`).to.match(
              /^\d{4}-\d{2}-\d{2}$/
            );
            expect(folder.pageCount, `folder[${i}].pageCount`).to.be.a(
              "number"
            );
            expect(folder.pages, `folder[${i}].pages`).to.be.an("array");
            expect(
              folder.contentSource,
              `folder[${i}].contentSource`
            ).to.be.oneOf(validContentSources);
            expect(folder.scrapedAt, `folder[${i}].scrapedAt`).to.be.a(
              "string"
            );
          });
        });

        it("each folder has at least one content method (embed, PDF, or pages)", () => {
          data.folders.forEach((folder: any, i: number) => {
            const hasEmbed =
              typeof folder.embedUrl === "string" && folder.embedUrl.length > 0;
            const hasPdf =
              typeof folder.pdfUrl === "string" && folder.pdfUrl.length > 0;
            const hasPages = folder.pages.length > 0;

            expect(
              hasEmbed || hasPdf || hasPages,
              `folder[${i}] must have embedUrl, pdfUrl, or pages`
            ).to.be.true;
          });
        });

        it("embed URLs are valid HTTP(S) URLs", () => {
          data.folders.forEach((folder: any) => {
            if (folder.embedUrl) {
              expect(folder.embedUrl).to.match(/^https?:\/\//);
              expect(folder.embedUrl).to.not.include("about:");
              expect(folder.embedUrl).to.not.include("javascript:");
            }
          });
        });

        it("PDF URLs are valid HTTP(S) URLs", () => {
          data.folders.forEach((folder: any) => {
            if (folder.pdfUrl) {
              expect(folder.pdfUrl).to.match(/^https?:\/\//);
            }
          });
        });

        it("pages have valid structure when present", () => {
          data.folders.forEach((folder: any) => {
            folder.pages.forEach((page: any, j: number) => {
              expect(page.pageNumber, `page[${j}].pageNumber`).to.be.a(
                "number"
              );
              expect(page.imageUrl, `page[${j}].imageUrl`).to.be.a("string")
                .and.not.be.empty;
              expect(page.deals, `page[${j}].deals`).to.be.an("array");
            });
          });
        });
      });

      describe("deals structure", () => {
        it("each deal has required fields when deals exist", () => {
          data.deals.forEach((deal: any, i: number) => {
            expect(deal.id, `deal[${i}].id`).to.be.a("string").and.not.be
              .empty;
            expect(deal.product, `deal[${i}].product`).to.be.a("string").and
              .not.be.empty;
            expect(deal.validFrom, `deal[${i}].validFrom`).to.be.a("string");
            expect(deal.validUntil, `deal[${i}].validUntil`).to.be.a("string");
            expect(deal.retailerSlug, `deal[${i}].retailerSlug`).to.equal(slug);
          });
        });

        it("deal prices are numbers when present", () => {
          data.deals.forEach((deal: any, i: number) => {
            if (deal.originalPrice !== undefined) {
              expect(deal.originalPrice, `deal[${i}].originalPrice`).to.be.a(
                "number"
              );
            }
            if (deal.promoPrice !== undefined) {
              expect(deal.promoPrice, `deal[${i}].promoPrice`).to.be.a(
                "number"
              );
            }
          });
        });
      });
    });
  });
});

describe("Content source coverage", () => {
  it("at least one retailer has an embed URL (Publitas/iPaper)", () => {
    const checks = retailerSlugs.map((slug) =>
      cy.readFile(`data/folders/${slug}.json`).then((data) => {
        return data.folders.some(
          (f: any) => f.embedUrl && f.embedUrl.startsWith("http")
        );
      })
    );

    cy.wrap(Promise.all(checks)).then((results) => {
      expect((results as boolean[]).some(Boolean)).to.be.true;
    });
  });

  it("every retailer has at least one content delivery method", () => {
    retailerSlugs.forEach((slug) => {
      cy.readFile(`data/folders/${slug}.json`).then((data) => {
        data.folders.forEach((folder: any) => {
          const has =
            !!folder.embedUrl || !!folder.pdfUrl || folder.pages.length > 0;
          expect(has, `${slug} must have content`).to.be.true;
        });
      });
    });
  });
});
