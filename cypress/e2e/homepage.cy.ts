describe("Homepage", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("renders the hero section with correct heading", () => {
    cy.get("h1").should("contain.text", "Alle folders en promoties");
    cy.get("h1").should("contain.text", "van je favoriete winkels");
  });

  it("displays the CTA buttons", () => {
    cy.contains("a", "Bekijk alle folders")
      .should("have.attr", "href", "/folders");

    cy.contains("a", "Facebook Groep")
      .should("have.attr", "href")
      .and("include", "facebook.com/groups/superpromobelgie");
  });

  it("displays all retailer cards", () => {
    const retailers = ["Albert Heijn", "Lidl", "Delhaize", "Colruyt", "ALDI", "Action"];

    retailers.forEach((name) => {
      cy.contains(name).should("be.visible");
    });
  });

  it("has working navigation links to retailer folder pages", () => {
    cy.contains("a", "Bekijk alle folders").click();
    cy.url().should("include", "/folders");
  });

  it("renders the USP section", () => {
    cy.contains("Laagste prijzen").should("be.visible");
    cy.contains("Altijd actueel").should("be.visible");
    cy.contains("Community").should("be.visible");
  });

  it("renders the Facebook CTA section", () => {
    cy.contains("Mis geen enkele promotie").should("be.visible");
    cy.contains("a", "Word lid van de groep")
      .should("have.attr", "target", "_blank");
  });

  it("renders SEO text section", () => {
    cy.contains("Over SuperPromo België").should("be.visible");
  });
});
