const retailers = [
  { slug: "albert-heijn", name: "Albert Heijn" },
  { slug: "lidl", name: "Lidl" },
  { slug: "delhaize", name: "Delhaize" },
  { slug: "colruyt", name: "Colruyt" },
  { slug: "aldi", name: "ALDI" },
  { slug: "action", name: "Action" },
];

describe("Retailer folder pages", () => {
  retailers.forEach(({ slug, name }) => {
    describe(`${name} page`, () => {
      beforeEach(() => {
        cy.visit(`/folders/${slug}`);
      });

      it("renders the page heading", () => {
        cy.get("h1").should("contain.text", `${name} folder deze week`);
      });

      it("displays the breadcrumb with correct links", () => {
        cy.get("nav").contains("Home").should("have.attr", "href", "/");
        cy.get("nav")
          .contains("Folders")
          .should("have.attr", "href", "/folders");
        cy.get("nav").contains(name).should("be.visible");
      });

      it("shows a folder viewer or empty state message", () => {
        cy.get("body").then(($body) => {
          const hasEmbed = $body.find("iframe").length > 0;
          const hasPages = $body.find("[class*='aspect']").length > 0;
          const hasEmptyState = $body.text().includes("momenteel geen folder");

          expect(hasEmbed || hasPages || hasEmptyState).to.be.true;
        });
      });

      it("displays action buttons", () => {
        cy.contains("a", `Bezoek ${name}`).should("exist");
        cy.contains("a", "Bekijk de beste deals in onze groep").should("exist");
      });

      it("renders the FAQ section", () => {
        cy.contains("Veelgestelde vragen").should("be.visible");
        cy.get("details").should("have.length.at.least", 3);
      });

      it("FAQ items are expandable", () => {
        cy.get("details").first().click();
        cy.get("details").first().find("p").should("be.visible");
      });
    });
  });
});
