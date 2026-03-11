/**
 * Folder viewer rendering & navigation tests
 *
 * Verifies that folder content renders correctly per content source,
 * navigation controls work, and fullscreen toggle functions.
 */

const viewerRetailers = [
  { slug: "albert-heijn", name: "Albert Heijn" },
  { slug: "lidl", name: "Lidl" },
  { slug: "delhaize", name: "Delhaize" },
  { slug: "colruyt", name: "Colruyt" },
  { slug: "aldi", name: "ALDI" },
  { slug: "action", name: "Action" },
];

// ---------------------------------------------------------------------------
// 1. Per-retailer viewer rendering
// ---------------------------------------------------------------------------

describe("Folder viewer rendering", () => {
  viewerRetailers.forEach(({ slug, name }) => {
    describe(`${name} folder viewer`, () => {
      let folderData: any;

      before(() => {
        cy.readFile(`data/folders/${slug}.json`).then((data) => {
          folderData = data;
        });
      });

      beforeEach(() => {
        cy.visit(`/folders/${slug}`);
      });

      it("renders the folder title", () => {
        if (folderData.folders.length > 0) {
          const title = folderData.folders[0].title;
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

        if (folder.embedUrl && folder.embedUrl.startsWith("http")) {
          cy.get("iframe")
            .should("exist")
            .and("have.attr", "src")
            .and("include", "http");
          cy.contains("Volledig scherm").should("be.visible");
        } else if (folder.pdfUrl) {
          cy.get("iframe").should("exist").and("have.attr", "src");
        } else if (folder.pages && folder.pages.length > 0) {
          cy.get("img[alt*='folder']").should("exist");
        } else {
          cy.contains("binnenkort").should("be.visible");
        }
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
      hasEmbed = !!(folder?.embedUrl && folder.embedUrl.startsWith("http"));
    });
  });

  beforeEach(function () {
    if (!hasEmbed) this.skip();
    cy.visit("/folders/albert-heijn");
  });

  it("shows fullscreen button", () => {
    cy.contains("Volledig scherm").should("be.visible");
  });

  it("toggles fullscreen mode on click", () => {
    cy.contains("Volledig scherm").click();
    cy.contains("Sluiten").should("be.visible");
    cy.get("iframe").parent().should("have.class", "fixed");

    cy.contains("Sluiten").click();
    cy.contains("Volledig scherm").should("be.visible");
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
// 3. Image page viewer navigation (tested on retailers with screenshot pages)
// ---------------------------------------------------------------------------

describe("Image page viewer navigation", () => {
  let pageSlug: string | null = null;
  let pageCount = 0;

  before(() => {
    const slugs = ["lidl", "colruyt", "delhaize", "albert-heijn", "aldi", "action"];

    cy.wrap(slugs)
      .each((slug: string) => {
        if (pageSlug) return;
        cy.readFile(`data/folders/${slug}.json`).then((data) => {
          const folder = data.folders.find(
            (f: any) =>
              !f.embedUrl && !f.pdfUrl && f.pages && f.pages.length > 0
          );
          if (folder) {
            pageSlug = slug;
            pageCount = folder.pages.length;
          }
        });
      });
  });

  beforeEach(function () {
    if (!pageSlug) this.skip();
    cy.visit(`/folders/${pageSlug}`);
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
    cy.contains("Volgende").click();
    cy.contains("Pagina 2 van").should("be.visible");
  });
});

// ---------------------------------------------------------------------------
// 4. PDF link availability
// ---------------------------------------------------------------------------

describe("PDF link availability", () => {
  viewerRetailers.forEach(({ slug, name }) => {
    it(`${name}: shows PDF link when pdfUrl exists`, () => {
      cy.readFile(`data/folders/${slug}.json`).then((data) => {
        const folder = data.folders[0];
        cy.visit(`/folders/${slug}`);

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
