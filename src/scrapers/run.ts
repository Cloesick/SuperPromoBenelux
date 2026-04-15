import path from "node:path";
import { scrapers } from "./scrapers";
import {
	MAX_RETRIES,
	RETRY_DELAY_MS,
	STALE_THRESHOLD_HOURS,
	sleep,
	checkLocalData,
	checkFolderExpiry,
	stripOfflineEmbeds,
	formatAge,
	type Status,
	type ScraperResult,
} from "./run-helpers";

const DATA_DIR = path.resolve(process.cwd(), "data", "folders");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const target = process.argv[2];

	const toRun = target
		? scrapers.filter((s) => s.retailerSlug === target)
		: scrapers;

	if (toRun.length === 0) {
		console.error(`Unknown retailer: ${target}`);
		console.log(`Available: ${scrapers.map((s) => s.retailerSlug).join(", ")}`);
		process.exit(1);
	}

	console.log(
		`Running ${toRun.length} scraper(s) (max ${MAX_RETRIES + 1} attempts each)...\n`,
	);

	const results: ScraperResult[] = [];

	for (const scraper of toRun) {
		const slug = scraper.retailerSlug;
		const name = scraper.retailerName;
		let lastError: string | undefined;
		let succeeded = false;
		let attempts = 0;

		// If existing data has expired folders, use extra retries
		const expiry = checkFolderExpiry(DATA_DIR, slug);
		const maxRetries = expiry.expired ? MAX_RETRIES + 1 : MAX_RETRIES;
		if (expiry.expired) {
			console.log(
				`  [${slug}] ⚠ Folder expired (validUntil: ${expiry.latestValidUntil}) — using extra retries`,
			);
		}

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			attempts = attempt + 1;

			if (attempt > 0) {
				console.log(
					`  [${slug}] Retry ${attempt}/${MAX_RETRIES} after ${RETRY_DELAY_MS / 1000}s...`,
				);
				await sleep(RETRY_DELAY_MS);
			}

			try {
				await scraper.run();
				succeeded = true;
				break;
			} catch (error) {
				lastError = error instanceof Error ? error.message : String(error);
				console.error(`  [${slug}] Attempt ${attempts} failed: ${lastError}`);
			}
		}

		if (succeeded) {
			// Post-scrape: strip offline embeds from expired folders
			stripOfflineEmbeds(DATA_DIR, slug);

			results.push({
				slug,
				name,
				status: attempts > 1 ? "retry_success" : "fresh",
				attempts,
			});
			console.log("");
			continue;
		}

		// All retries exhausted — check local fallback
		console.log(
			`  [${slug}] All ${attempts} attempts failed. Checking fallbacks...`,
		);

		// Strip offline embeds from local data even when scraper failed
		stripOfflineEmbeds(DATA_DIR, slug);

		const local = checkLocalData(DATA_DIR, slug);
		if (local.valid) {
			const isStale =
				local.ageHours !== null && local.ageHours > STALE_THRESHOLD_HOURS;
			results.push({
				slug,
				name,
				status: isStale ? "stale" : "fallback_local",
				attempts,
				error: lastError,
				dataAge: formatAge(local.ageHours),
			});
			console.log(
				`  [${slug}] Using existing local data (age: ${formatAge(local.ageHours)})${isStale ? " ⚠ STALE" : ""}`,
			);
		} else {
			results.push({
				slug,
				name,
				status: "missing",
				attempts,
				error: lastError,
			});
			console.error(
				`  [${slug}] ✗ NO DATA AVAILABLE — all fallbacks exhausted`,
			);
		}

		console.log("");
	}

	// --- Summary ---
	printSummary(results);
}

function printSummary(results: ScraperResult[]) {
	const icons: Record<Status, string> = {
		fresh: "✓",
		retry_success: "✓ (retry)",
		fallback_local: "⟲ local",
		stale: "⚠ stale",
		missing: "✗ MISSING",
	};

	console.log("=== Scrape Summary ===");
	for (const r of results) {
		const age = r.dataAge ? ` [${r.dataAge} old]` : "";
		const err = r.error ? ` — ${r.error}` : "";
		console.log(`  ${icons[r.status]} ${r.name}${age}${err}`);
	}

	const fresh = results.filter(
		(r) => r.status === "fresh" || r.status === "retry_success",
	);
	const fallbacks = results.filter((r) => r.status === "fallback_local");
	const stale = results.filter((r) => r.status === "stale");
	const missing = results.filter((r) => r.status === "missing");

	console.log("");
	console.log(
		`  Fresh: ${fresh.length} | Fallback: ${fallbacks.length} | Stale: ${stale.length} | Missing: ${missing.length}`,
	);

	if (missing.length > 0) {
		console.error(`\n${missing.length} retailer(s) have NO data at all!`);
		process.exit(1);
	}

	if (stale.length > 0) {
		console.warn(
			`\n⚠ ${stale.length} retailer(s) have stale data (>${STALE_THRESHOLD_HOURS}h). Consider investigating.`,
		);
	}
}

main();
