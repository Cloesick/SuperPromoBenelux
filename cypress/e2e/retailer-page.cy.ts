const generalRetailers = [
	{ slug: "albert-heijn", name: "Albert Heijn" },
	{ slug: "lidl", name: "Lidl" },
	{ slug: "delhaize", name: "Delhaize" },
	{ slug: "colruyt", name: "Colruyt" },
	{ slug: "aldi", name: "ALDI" },
	{ slug: "action", name: "Action" },
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
					// trailingSlash is on, so the rendered href is "/folders/".
					.should("have.attr", "href")
					.and("match", /^\/folders\/?$/);
			});

			it("shows a folder viewer or empty state message", () => {
				// .should() with a callback retries; .then() runs once. FolderViewer
				// is a client component, so on a cold page the assertion used to fire
				// before React had rendered any of these and reported "expected false
				// to equal true" for pages that render perfectly well.
				cy.get("body").should(($body) => {
					const hasEmbed = $body.find("iframe").length > 0;
					const hasPages =
						$body.find("img[alt*='folder pagina']").length > 0 ||
						$body.find("button:contains('Pagina')").length > 0 ||
						$body.find('button:contains("Pagina\'s")').length > 0;
					// Two different empty states exist. The retailer page renders
					// "Er is momenteel geen folder beschikbaar" when there is no
					// folder at all; FolderViewer renders "De folderpagina's worden
					// binnenkort geladen." when a folder exists but nothing in it can
					// be rendered — albert-heijn and lidl both land there, because
					// their embed is a Publitas URL the viewer refuses to frame and
					// their PDF is attachment-disposition.
					const text = $body.text();
					const hasEmptyState =
						/(?:momenteel geen|binnenkort|kunnen we hier niet tonen|nog geen folder beschikbaar)/i.test(
							text,
						);

					expect(
						hasEmbed || hasPages || hasEmptyState,
						"renders a viewer or an honest empty state",
					).to.equal(true);
				});
			});
		});
	});
});
