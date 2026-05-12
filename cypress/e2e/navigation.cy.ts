describe("Navigation", () => {
  it("navigates through the site using the header", () => {
    cy.visit("/");

    cy.get("header").contains("Folders").click();
    cy.url().should("include", "/folders");
    cy.get("h1").should("contain.text", "Alle folders");

    cy.get("header").contains("Over Ons").click();
    cy.url().should("include", "/over-ons");
    cy.get("h1").should("contain.text", "Over SuperPromo België");

    cy.get("header").contains("Home").click();
    cy.url().should("eq", Cypress.config("baseUrl") + "/");
  });

  it("navigates home via the logo", () => {
    cy.visit("/folders");
    cy.get("header a").first().click();
    cy.url().should("eq", Cypress.config("baseUrl") + "/");
  });

  it("renders the footer with correct links", () => {
    cy.visit("/");

    cy.get("footer").within(() => {
      cy.contains("a", "Home").should("have.attr", "href", "/");
      cy.contains("a", "Alle Folders").should("have.attr", "href", "/folders");
      cy.contains("a", "Over Ons").should("have.attr", "href", "/over-ons");
      cy.contains("a", "Privacy").should("have.attr", "href", "/privacy");
      cy.contains("a", "Contact").should("have.attr", "href", "/contact");
    });
  });

  it("has external links opening in new tabs", () => {
    cy.visit("/");
    cy.get('a[target="_blank"]').each(($link) => {
      cy.wrap($link).should("have.attr", "rel").and("include", "noopener");
    });
  });
});
