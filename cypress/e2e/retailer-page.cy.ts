const generalRetailers = [
	{ slug: "albert-heijn", name: "Albert Heijn" },
	{ slug: "lidl", name: "Lidl" },
	{ slug: "delhaize", name: "Delhaize" },
	{ slug: "colruyt", name: "Colruyt" },
	{ slug: "aldi", name: "ALDI" },
	{ slug: "action", name: "Action" },
];

const verticalRetailers = [
	// Pet
	{ slug: "maxi-zoo", name: "Maxi Zoo", vertical: "pet" },
	{ slug: "tom-co", name: "Tom&Co", vertical: "pet" },
	{ slug: "zooplus", name: "Zooplus", vertical: "pet" },
	{ slug: "aveve", name: "AVEVE", vertical: "pet" },
	{ slug: "medpets", name: "Medpets", vertical: "pet" },
	// Electro
	{ slug: "mediamarkt", name: "MediaMarkt", vertical: "electro" },
	{ slug: "coolblue", name: "Coolblue", vertical: "electro" },
	{ slug: "vanden-borre", name: "Vanden Borre", vertical: "electro" },
	{ slug: "krefel", name: "Krëfel", vertical: "electro" },
	{ slug: "bol", name: "bol", vertical: "electro" },
	// Fashion
	{ slug: "hm", name: "H&M", vertical: "fashion" },
	{ slug: "zalando", name: "Zalando", vertical: "fashion" },
	// Home & Garden
	{ slug: "ikea", name: "IKEA", vertical: "home-garden" },
	{ slug: "gamma", name: "Gamma", vertical: "home-garden" },
	// Beauty
	{ slug: "kruidvat", name: "Kruidvat", vertical: "beauty" },
	{ slug: "ici-paris-xl", name: "ICI PARIS XL", vertical: "beauty" },
	{ slug: "douglas", name: "Douglas", vertical: "beauty" },
	{ slug: "di", name: "Di", vertical: "beauty" },
	{ slug: "etos", name: "Etos", vertical: "beauty" },
	{ slug: "boots", name: "Boots", vertical: "beauty" },
	{ slug: "muller", name: "Müller", vertical: "beauty" },
	{ slug: "rossmann", name: "Rossmann", vertical: "beauty" },
	{ slug: "treac", name: "Trekpleister", vertical: "beauty" },
	{ slug: "rituals", name: "Rituals", vertical: "beauty" },
	{ slug: "yves-rocher", name: "Yves Rocher", vertical: "beauty" },
	{ slug: "the-body-shop", name: "The Body Shop", vertical: "beauty" },
];

describe("Retailer folder pages — general", () => {
	generalRetailers.forEach(({ slug, name }) => {
		describe(`${name} page`, () => {
			beforeEach(() => {
				cy.visit(`/folders/${slug}`);
			});

			it("renders the page heading", () => {
				cy.get("h1").should("contain.text", `${name} folder`);
			});

			it("displays the breadcrumb with correct links", () => {
				cy.get("nav").contains("Home").should("have.attr", "href", "/");
				cy.get("nav")
					.contains("Folders")
					.should("have.attr", "href", "/folders");
			});

			it("shows a folder viewer or empty state message", () => {
				cy.get("body").then(($body) => {
					const hasEmbed = $body.find("iframe").length > 0;
					const hasPages =
						$body.find("img[alt*='folder pagina']").length > 0 ||
						$body.find("button:contains('Pagina')").length > 0 ||
						$body.find('button:contains("Pagina\'s")').length > 0;
					const hasEmptyState = $body.text().includes("momenteel geen");

					expect(hasEmbed || hasPages || hasEmptyState).to.equal(true);
				});
			});
		});
	});
});

describe("Retailer folder pages — verticals", () => {
	verticalRetailers.forEach(({ slug, name, vertical }) => {
		describe(`${name} page (/${vertical})`, () => {
			beforeEach(() => {
				cy.visit(`/${vertical}/folders/${slug}`);
			});

			it("renders the page heading", () => {
				cy.get("h1").should("contain.text", `${name} folder`);
			});

			it("displays the breadcrumb with vertical links", () => {
				cy.get("nav").contains("Home").should("have.attr", "href", "/");
				cy.get("nav a[href*='/" + vertical + "']").should("exist");
			});

			it("shows a folder viewer or empty state message", () => {
				cy.get("body").then(($body) => {
					const hasEmbed = $body.find("iframe").length > 0;
					const hasPages =
						$body.find("img[alt*='folder pagina']").length > 0 ||
						$body.find("button:contains('Pagina')").length > 0 ||
						$body.find('button:contains("Pagina\'s")').length > 0;
					const hasEmptyState = $body.text().includes("momenteel geen");

					expect(hasEmbed || hasPages || hasEmptyState).to.equal(true);
				});
			});
		});
	});
});
