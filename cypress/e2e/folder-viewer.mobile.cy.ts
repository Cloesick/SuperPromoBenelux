/**
 * Mobile (smartphone) folder viewer tests
 *
 * Goal: validate the mobile-specific rendering paths (PDF open fallback, iOS embed fallback links)
 * without trying to introspect cross-origin iframe/PDF contents.
 */

import { expectedViewer, type FolderFile } from "../support/folderData";

describe("Folder viewer (mobile)", () => {
	function visitAsIphone(path: string) {
		cy.viewport(390, 844); // iPhone 12/13/14-ish

		cy.visit(path, {
			onBeforeLoad(win) {
				// Ensure our iOS-specific UI branches (FolderViewer checks navigator.userAgent)
				// are exercised in CI/desktop runs.
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(win.navigator as any).__defineGetter__(
					"userAgent",
					() =>
						"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
				);

				// Seed the cookie choice rather than chasing the banner: it is fixed to
				// the bottom of the viewport, which on a 390x844 screen covers most of
				// the mobile fallback links this spec clicks.
				win.localStorage.setItem("sp_cookie_consent", "declined");
			},
		});
	}

	const slugs = ["albert-heijn", "action", "aldi", "lidl"];

	slugs.forEach((slug) => {
		it(`${slug}: renders the correct iPhone fallback path`, () => {
			cy.readFile(`data/folders/${slug}.json`).then((data: FolderFile) => {
				const folder = data.folders?.[0];
				expect(folder, "folder should exist").to.not.equal(undefined);

				visitAsIphone(`/folders/${slug}`);

				switch (expectedViewer(folder, slug)) {
					case "pages":
						cy.get("img[alt*='folder pagina']").should("exist");
						cy.contains("Pagina 1 van").should("be.visible");
						break;

					case "pdf":
						// The PDF mode button only exists when the PDF can be framed at
						// all; albert-heijn and lidl sign theirs with
						// response-content-disposition=attachment, which is why this
						// branch no longer runs for them.
						cy.contains("button", "PDF").should("be.visible").click();
						cy.contains("a", "Open PDF")
							.should("be.visible")
							.and("have.attr", "href", folder.pdfUrl)
							.and("have.attr", "target", "_blank");
						break;

					case "embed":
						cy.contains("a", "Open in nieuw tabblad")
							.should("be.visible")
							.and("have.attr", "href", folder.embedUrl)
							.and("have.attr", "target", "_blank");
						cy.get("iframe").should("exist");
						break;

					default:
						// albert-heijn and lidl land here: a Publitas embed the app
						// refuses to frame plus an attachment-only PDF leaves nothing to
						// show, so the viewer says so and keeps the download link.
						cy.contains(/(?:binnenkort|kunnen we hier niet tonen|nog geen folder beschikbaar|momenteel geen)/i).should("be.visible");
						if (folder.pdfUrl) {
							cy.get(`a[href="${folder.pdfUrl}"]`)
								.first()
								.should("have.attr", "target", "_blank");
						}
				}
			});
		});
	});
});
