import fs from "node:fs";
import path from "node:path";
import { scrapers } from "./scrapers";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2; // total attempts = 1 + MAX_RETRIES
const RETRY_DELAY_MS = 5_000;
const STALE_THRESHOLD_HOURS = 168; // 7 days
const DATA_DIR = path.resolve(process.cwd(), "data", "folders");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Status =
	| "fresh"
	| "retry_success"
	| "fallback_local"
	| "stale"
	| "missing";

interface ScraperResult {
	slug: string;
	name: string;
	status: Status;
	attempts: number;
	error?: string;
	dataAge?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

function getDataFilePath(slug: string): string {
	return path.join(DATA_DIR, `${slug}.json`);
}

function checkLocalData(slug: string): {
	valid: boolean;
	ageHours: number | null;
} {
	const filePath = getDataFilePath(slug);
	if (!fs.existsSync(filePath)) return { valid: false, ageHours: null };

	try {
		const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		if (!Array.isArray(data.folders)) return { valid: false, ageHours: null };

		const scrapedAt = data.scrapedAt ? new Date(data.scrapedAt) : null;
		const ageHours = scrapedAt
			? (Date.now() - scrapedAt.getTime()) / 3_600_000
			: null;

		return { valid: true, ageHours };
	} catch {
		return { valid: false, ageHours: null };
	}
}

function formatAge(hours: number | null): string {
	if (hours === null) return "unknown age";
	if (hours < 1) return `${Math.round(hours * 60)}m`;
	if (hours < 24) return `${Math.round(hours)}h`;
	return `${Math.round(hours / 24)}d`;
}

/**
 * Check if the most recent folder in existing data has expired.
 * Expired folders mean the embed/PDF is likely offline (Publitas takes them down).
 */
function checkFolderExpiry(slug: string): {
	expired: boolean;
	latestValidUntil: string | null;
} {
	const filePath = getDataFilePath(slug);
	if (!fs.existsSync(filePath))
		return { expired: false, latestValidUntil: null };

	try {
		const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		if (!Array.isArray(data.folders) || data.folders.length === 0)
			return { expired: false, latestValidUntil: null };

		const latest = data.folders[0];
		const vu = latest.validUntil;
		if (!vu) return { expired: false, latestValidUntil: null };

		const until = new Date(vu + "T23:59:59");
		return { expired: until < new Date(), latestValidUntil: vu };
	} catch {
		return { expired: false, latestValidUntil: null };
	}
}

/**
 * After a scrape, strip embed/PDF URLs from expired folders when they point to
 * hosts that are known to take publications offline (Publitas, Folderz).
 * This prevents the frontend from rendering a dead iframe.
 */
function stripOfflineEmbeds(slug: string): void {
	const filePath = getDataFilePath(slug);
	if (!fs.existsSync(filePath)) return;

	try {
		const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		if (!Array.isArray(data.folders)) return;

		let modified = false;
		const now = new Date();

		for (const folder of data.folders) {
			if (!folder.validUntil) continue;
			try {
				const until = new Date(folder.validUntil + "T23:59:59");
				if (until >= now) continue;
			} catch {
				continue;
			}

			if (
				folder.embedUrl &&
				/publitas\.com|folderz\.be/i.test(folder.embedUrl)
			) {
				console.log(
					`  [${slug}] Stripping offline embed from expired folder: ${folder.embedUrl}`,
				);
				folder.embedUrl = "";
				modified = true;
			}
			if (folder.pdfUrl && /publitas\.com|folderz\.be/i.test(folder.pdfUrl)) {
				console.log(
					`  [${slug}] Stripping offline PDF from expired folder: ${folder.pdfUrl}`,
				);
				folder.pdfUrl = "";
				modified = true;
			}
		}

		if (modified) {
			fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
		}
	} catch {
		// ignore
	}
}

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
		const expiry = checkFolderExpiry(slug);
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
			stripOfflineEmbeds(slug);

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
		stripOfflineEmbeds(slug);

		const local = checkLocalData(slug);
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
