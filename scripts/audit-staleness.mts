// ---------------------------------------------------------------------------
// Read-only staleness audit over data/folders/*.json.
//
//   npm run audit:staleness
//
// Exits 1 when anything is expired, blind or empty, so a scheduler or CI step
// can treat "our data quietly went stale" as a failing build rather than
// something a human has to notice. Touches no network and writes nothing.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import {
	assessStaleness,
	formatStalenessReport,
	hasCriticalStaleness,
	type StalenessVerdict,
} from "../src/scrapers/staleness";

const DATA_DIR = path.resolve(process.cwd(), "data", "folders");

function main() {
	if (!fs.existsSync(DATA_DIR)) {
		console.error(`No data directory at ${DATA_DIR}`);
		process.exit(1);
	}

	const files = fs
		.readdirSync(DATA_DIR)
		.filter((f) => f.endsWith(".json"))
		.sort();

	const verdicts: StalenessVerdict[] = [];

	for (const file of files) {
		const slug = file.replace(/\.json$/, "");
		let parsed: unknown;
		try {
			parsed = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
		} catch {
			// A corrupt file is worse than a stale one; surface it as empty rather
			// than skipping it silently, which is the failure mode this whole module
			// exists to stop.
			verdicts.push({
				slug,
				level: "empty",
				daysExpired: null,
				dealCount: 0,
				pricedCount: 0,
				reason: "unreadable or malformed JSON",
			});
			continue;
		}

		const data = parsed as {
			folders?: { validUntil?: string }[];
			deals?: { promoPrice?: number; originalPrice?: number }[];
		};
		const folders = Array.isArray(data.folders) ? data.folders : [];
		const deals = Array.isArray(data.deals) ? data.deals : [];

		// Latest validUntil, so a retailer publishing next week's folder early is
		// judged on the one that is actually current.
		const validUntil =
			folders
				.map((f) => f.validUntil)
				.filter((v): v is string => typeof v === "string")
				.sort()
				.pop() ?? null;

		verdicts.push(
			assessStaleness({ slug, validUntil, deals, folderCount: folders.length }),
		);
	}

	console.log("=== Staleness audit ===");
	console.log(formatStalenessReport(verdicts));

	if (hasCriticalStaleness(verdicts)) {
		console.log("");
		console.log("Critical staleness present — exiting 1.");
		process.exit(1);
	}
}

main();
