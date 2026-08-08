import { defineConfig } from "cypress";
import fs from "node:fs";
import path from "node:path";

export default defineConfig({
	projectId: "wz2h7a",
	e2e: {
		baseUrl: "http://localhost:3000",
		viewportWidth: 1280,
		viewportHeight: 720,
		defaultCommandTimeout: 10000,
		video: true,
		screenshotOnRunFailure: true,
		setupNodeEvents(on) {
			on("task", {
				/**
				 * Every retailer that has folder data on disk.
				 *
				 * folder-expectations.cy.ts iterates a committed baseline, so a
				 * retailer added to data/folders without a baseline entry would be
				 * silently untested. This lets the spec notice that.
				 */
				listFolderSlugs() {
					const dir = path.join(process.cwd(), "data", "folders");
					if (!fs.existsSync(dir)) return [];
					return fs
						.readdirSync(dir)
						.filter((f) => f.endsWith(".json"))
						.map((f) => f.replace(/\.json$/, ""))
						.sort();
				},
			});
		},
	},
});
