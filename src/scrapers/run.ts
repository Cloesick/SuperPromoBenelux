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
	probeEmbedLiveness,
	validateScrapedData,
	generateHealthManifest,
	formatAge,
	type Status,
	type ScraperResult,
	type ValidationIssue,
	type ProbeResult,
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

	// --- Post-scrape: validate data & probe embed liveness ---
	console.log("\n=== Post-scrape checks ===");
	const validationMap = new Map<string, ValidationIssue[]>();
	const probeMap = new Map<string, ProbeResult[]>();

	for (const r of results) {
		// Validate data integrity
		const issues = validateScrapedData(DATA_DIR, r.slug);
		validationMap.set(r.slug, issues);
		const errors = issues.filter((i) => i.severity === "error");
		const warnings = issues.filter((i) => i.severity === "warning");
		if (errors.length > 0) {
			console.error(
				`  [${r.slug}] ✗ ${errors.length} validation error(s): ${errors.map((e) => e.message).join("; ")}`,
			);
		}
		if (warnings.length > 0) {
			console.warn(
				`  [${r.slug}] ⚠ ${warnings.length} validation warning(s): ${warnings.map((w) => w.message).join("; ")}`,
			);
		}

		// Probe embed/PDF liveness (only for retailers that have data)
		if (r.status !== "missing") {
			const probes = await probeEmbedLiveness(DATA_DIR, r.slug);
			probeMap.set(r.slug, probes);
			const dead = probes.filter((p) => !p.live);
			if (dead.length > 0) {
				console.warn(
					`  [${r.slug}] ⚠ ${dead.length} dead URL(s) stripped: ${dead.map((d) => `${d.url} (${d.status})`).join("; ")}`,
				);
			}
		}
	}

	// --- Health manifest ---
	const manifest = generateHealthManifest(
		DATA_DIR,
		results,
		validationMap,
		probeMap,
	);
	console.log(
		`\nHealth manifest written (${manifest.summary.total} retailers)`,
	);

	// --- Summary ---
	printSummary(results, manifest);
}

function printSummary(
	results: ScraperResult[],
	manifest: import("./run-helpers").HealthManifest,
) {
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

	const { summary } = manifest;

	console.log("");
	console.log(
		`  Fresh: ${summary.fresh} | Fallback: ${summary.fallback} | Stale: ${summary.stale} | Missing: ${summary.missing}`,
	);
	if (summary.withDeadUrls > 0) {
		console.warn(
			`  ⚠ Dead embed/PDF URLs stripped: ${summary.withDeadUrls} retailer(s)`,
		);
	}
	if (summary.withErrors > 0) {
		console.error(`  ✗ Validation errors: ${summary.withErrors} retailer(s)`);
	}

	if (summary.missing > 0) {
		console.error(`\n${summary.missing} retailer(s) have NO data at all!`);
		process.exit(1);
	}

	if (summary.stale > 0) {
		console.warn(
			`\n⚠ ${summary.stale} retailer(s) have stale data (>${STALE_THRESHOLD_HOURS}h). Consider investigating.`,
		);
	}
}

main();
