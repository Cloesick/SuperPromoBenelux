/**
 * Mobile (smartphone) folder viewer tests
 *
 * Goal: validate the mobile-specific rendering paths (PDF open fallback, iOS embed fallback links)
 * without trying to introspect cross-origin iframe/PDF contents.
 */

describe("Folder viewer (mobile)", () => {
	function dismissCookieBanners(attemptsLeft = 8): void {
		cy.get("body").then(($body) => {
			const candidates = [
				"Alle cookies accepteren",
				"Aanvaarden",
				"Accepteren",
			];

			let clicked = false;
			for (const label of candidates) {
				const selector = `button:contains('${label}')`;
				if ($body.find(selector).length > 0) {
					clicked = true;
					cy.contains("button", label).click({ force: true });
				}
			}

			if (!clicked && attemptsLeft > 0) {
				cy.wait(250).then(() => dismissCookieBanners(attemptsLeft - 1));
			}
		});
	}

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
			},
		});

		dismissCookieBanners();
	}

	const slugs = ["albert-heijn", "action", "aldi", "lidl"];

	slugs.forEach((slug) => {
		it(`${slug}: renders the correct iPhone fallback path (PDF if available, else embed link)`, () => {
			cy.readFile(`data/folders/${slug}.json`).then((data) => {
				const folder = data.folders?.[0];
				expect(folder, "folder should exist").to.not.equal(undefined);

				visitAsIphone(`/folders/${slug}`);

				// FolderViewer prefers pages mode whenever pages exist.
				if (folder?.pages && folder.pages.length > 0) {
					cy.get("img[alt*='folder']").should("exist");
					cy.contains("Pagina 1 van").should("be.visible");
					return;
				}

				if (folder?.pdfUrl) {
					cy.contains("button", "PDF").should("be.visible").click();
					cy.contains("Open PDF")
						.should("be.visible")
						.closest("a")
						.should("have.attr", "href", folder.pdfUrl)
						.and("have.attr", "target", "_blank");
					return;
				}

				if (folder?.embedUrl) {
					cy.contains("Open in nieuw tabblad").should("be.visible");
					cy.get('a[target="_blank"]')
						.contains("Open in nieuw tabblad")
						.should(($a) => {
							const href = $a.attr("href");
							expect(href).to.equal(folder.embedUrl);
						});

					cy.get("iframe").should("exist");
					return;
				}

				cy.contains("binnenkort").should("be.visible");
			});
		});
	});
});
