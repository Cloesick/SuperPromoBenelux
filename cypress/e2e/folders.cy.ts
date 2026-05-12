describe("Folders overview page", () => {
  beforeEach(() => {
    cy.visit("/folders");
  });

  it("renders the page heading", () => {
    cy.get("h1").should("contain.text", "Alle folders van deze week");
  });

  it("displays the breadcrumb navigation", () => {
    cy.get("nav").contains("Home").should("have.attr", "href", "/");
    cy.get("nav").contains("Folders").should("be.visible");
  });

  it("displays supermarket retailer cards", () => {
    cy.contains("h2", "Supermarkten").should("be.visible");

    const retailers = ["Albert Heijn", "Lidl", "Delhaize", "Colruyt", "ALDI"];
    retailers.forEach((name) => {
      cy.contains(name).should("be.visible");
    });
  });

  it("navigates to a retailer page on card click", () => {
    cy.contains("a", "Albert Heijn").first().click();
    cy.url().should("include", "/folders/albert-heijn");
  });
});
