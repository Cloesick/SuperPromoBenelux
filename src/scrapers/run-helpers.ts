import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const MAX_RETRIES = 2; // total attempts = 1 + MAX_RETRIES
export const RETRY_DELAY_MS = 5_000;
export const STALE_THRESHOLD_HOURS = 168; // 7 days

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Status =
	| "fresh"
	| "retry_success"
	| "fallback_local"
	| "stale"
	| "missing";

export interface ScraperResult {
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

export function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

export function getDataFilePath(dataDir: string, slug: string): string {
	return path.join(dataDir, `${slug}.json`);
}

export function checkLocalData(
	dataDir: string,
	slug: string,
): {
	valid: boolean;
	ageHours: number | null;
} {
	const filePath = getDataFilePath(dataDir, slug);
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

export function formatAge(hours: number | null): string {
	if (hours === null) return "unknown age";
	if (hours < 1) return `${Math.round(hours * 60)}m`;
	if (hours < 24) return `${Math.round(hours)}h`;
	return `${Math.round(hours / 24)}d`;
}

/**
 * Check if the most recent folder in existing data has expired.
 * Expired folders mean the embed/PDF is likely offline (Publitas takes them down).
 */
export function checkFolderExpiry(
	dataDir: string,
	slug: string,
): {
	expired: boolean;
	latestValidUntil: string | null;
} {
	const filePath = getDataFilePath(dataDir, slug);
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

// ---------------------------------------------------------------------------
// Embed liveness probing
// ---------------------------------------------------------------------------

export interface ProbeResult {
	url: string;
	status: number | null;
	live: boolean;
	error?: string;
}

/**
 * Probe embed and PDF URLs in a retailer's data file via HTTP HEAD.
 * Dead URLs (4xx/5xx) are stripped from the JSON to prevent broken iframes.
 * Returns results for logging/health manifest.
 */
export async function probeEmbedLiveness(
	dataDir: string,
	slug: string,
	timeoutMs = 10_000,
): Promise<ProbeResult[]> {
	const filePath = getDataFilePath(dataDir, slug);
	if (!fs.existsSync(filePath)) return [];

	let data: any;
	try {
		data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch {
		return [];
	}
	if (!Array.isArray(data.folders)) return [];

	const results: ProbeResult[] = [];
	let modified = false;

	for (const folder of data.folders) {
		for (const key of ["embedUrl", "pdfUrl"] as const) {
			const url = folder[key];
			if (!url || typeof url !== "string" || !url.startsWith("http")) continue;

			const probe = await probeUrl(url, timeoutMs);
			results.push(probe);

			if (!probe.live && probe.status !== null) {
				folder[key] = "";
				modified = true;
			}
		}
	}

	if (modified) {
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	}

	return results;
}

/**
 * HTTP HEAD check on a single URL. Returns status and liveness.
 * A URL is considered dead only on clear 4xx/5xx responses.
 * Timeouts and network errors are treated as "unknown" (live = true) to avoid
 * stripping URLs that are temporarily unreachable.
 */
export async function probeUrl(
	url: string,
	timeoutMs = 10_000,
): Promise<ProbeResult> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		const res = await fetch(url, {
			method: "HEAD",
			redirect: "follow",
			signal: controller.signal,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			},
		});
		clearTimeout(timer);
		const live = res.status < 400;
		return { url, status: res.status, live };
	} catch (err) {
		// Network errors / timeouts → treat as live (don't strip)
		return {
			url,
			status: null,
			live: true,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}

// ---------------------------------------------------------------------------
// Data validation
// ---------------------------------------------------------------------------

export interface ValidationIssue {
	field: string;
	message: string;
	severity: "error" | "warning";
}

/**
 * Validate a retailer's scraped data for integrity issues.
 * Returns a list of issues found. Empty list = clean.
 */
export function validateScrapedData(
	dataDir: string,
	slug: string,
): ValidationIssue[] {
	const filePath = getDataFilePath(dataDir, slug);
	if (!fs.existsSync(filePath))
		return [
			{ field: "file", message: "Data file does not exist", severity: "error" },
		];

	let data: any;
	try {
		data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch {
		return [{ field: "file", message: "Invalid JSON", severity: "error" }];
	}

	const issues: ValidationIssue[] = [];
	const dateRe = /^\d{4}-\d{2}-\d{2}$/;

	if (!Array.isArray(data.folders)) {
		issues.push({
			field: "folders",
			message: "Missing or not an array",
			severity: "error",
		});
		return issues;
	}

	if (data.folders.length === 0) {
		issues.push({
			field: "folders",
			message: "Empty folders array",
			severity: "warning",
		});
	}

	for (let i = 0; i < data.folders.length; i++) {
		const f = data.folders[i];
		const prefix = `folders[${i}]`;

		if (!f.title || typeof f.title !== "string") {
			issues.push({
				field: `${prefix}.title`,
				message: "Missing or invalid title",
				severity: "error",
			});
		}
		if (!f.validFrom || !dateRe.test(f.validFrom)) {
			issues.push({
				field: `${prefix}.validFrom`,
				message: `Invalid date: ${f.validFrom}`,
				severity: "error",
			});
		}
		if (!f.validUntil || !dateRe.test(f.validUntil)) {
			issues.push({
				field: `${prefix}.validUntil`,
				message: `Invalid date: ${f.validUntil}`,
				severity: "error",
			});
		}
		if (typeof f.pageCount === "number" && Array.isArray(f.pages)) {
			if (f.pageCount !== f.pages.length) {
				issues.push({
					field: `${prefix}.pageCount`,
					message: `Mismatch: pageCount=${f.pageCount} but pages.length=${f.pages.length}`,
					severity: "warning",
				});
			}
		}
		if (f.embedUrl && typeof f.embedUrl === "string" && f.embedUrl.length > 0) {
			if (!f.embedUrl.startsWith("http")) {
				issues.push({
					field: `${prefix}.embedUrl`,
					message: `Not a valid URL: ${f.embedUrl}`,
					severity: "warning",
				});
			}
		}
		if (f.pdfUrl && typeof f.pdfUrl === "string" && f.pdfUrl.length > 0) {
			if (!f.pdfUrl.startsWith("http")) {
				issues.push({
					field: `${prefix}.pdfUrl`,
					message: `Not a valid URL: ${f.pdfUrl}`,
					severity: "warning",
				});
			}
		}
		// Check content: must have at least one of embed, pdf, pages, or deals
		const hasContent =
			(f.embedUrl && f.embedUrl.length > 0) ||
			(f.pdfUrl && f.pdfUrl.length > 0) ||
			(Array.isArray(f.pages) && f.pages.length > 0);
		if (!hasContent) {
			issues.push({
				field: `${prefix}`,
				message:
					"Folder has no embed, PDF, or pages — will show empty on frontend",
				severity: "warning",
			});
		}
	}

	return issues;
}

// ---------------------------------------------------------------------------
// Health manifest
// ---------------------------------------------------------------------------

export interface HealthEntry {
	slug: string;
	name: string;
	status: Status;
	attempts: number;
	dataAge: string | null;
	scrapedAt: string | null;
	folderCount: number;
	dealCount: number;
	hasEmbed: boolean;
	hasPdf: boolean;
	hasPages: boolean;
	validationIssues: ValidationIssue[];
	probeResults: ProbeResult[];
	error?: string;
}

export interface HealthManifest {
	generatedAt: string;
	retailers: HealthEntry[];
	summary: {
		total: number;
		fresh: number;
		fallback: number;
		stale: number;
		missing: number;
		withErrors: number;
		withDeadUrls: number;
	};
}

/**
 * Generate a health manifest summarising the state of all retailer data.
 * Written to `data/health.json` for CI/monitoring consumption.
 */
export function generateHealthManifest(
	dataDir: string,
	results: ScraperResult[],
	validationMap: Map<string, ValidationIssue[]>,
	probeMap: Map<string, ProbeResult[]>,
): HealthManifest {
	const retailers: HealthEntry[] = results.map((r) => {
		const filePath = getDataFilePath(dataDir, r.slug);
		let scrapedAt: string | null = null;
		let folderCount = 0;
		let dealCount = 0;
		let hasEmbed = false;
		let hasPdf = false;
		let hasPages = false;

		try {
			const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
			scrapedAt = data.scrapedAt || null;
			if (Array.isArray(data.folders)) {
				folderCount = data.folders.length;
				for (const f of data.folders) {
					if (f.embedUrl && f.embedUrl.length > 0) hasEmbed = true;
					if (f.pdfUrl && f.pdfUrl.length > 0) hasPdf = true;
					if (Array.isArray(f.pages) && f.pages.length > 0) hasPages = true;
				}
			}
			if (Array.isArray(data.deals)) dealCount = data.deals.length;
		} catch {
			// file missing or invalid
		}

		return {
			slug: r.slug,
			name: r.name,
			status: r.status,
			attempts: r.attempts,
			dataAge: r.dataAge || null,
			scrapedAt,
			folderCount,
			dealCount,
			hasEmbed,
			hasPdf,
			hasPages,
			validationIssues: validationMap.get(r.slug) || [],
			probeResults: probeMap.get(r.slug) || [],
			error: r.error,
		};
	});

	const deadUrls = retailers.filter((r) => r.probeResults.some((p) => !p.live));

	const manifest: HealthManifest = {
		generatedAt: new Date().toISOString(),
		retailers,
		summary: {
			total: retailers.length,
			fresh: retailers.filter(
				(r) => r.status === "fresh" || r.status === "retry_success",
			).length,
			fallback: retailers.filter((r) => r.status === "fallback_local").length,
			stale: retailers.filter((r) => r.status === "stale").length,
			missing: retailers.filter((r) => r.status === "missing").length,
			withErrors: retailers.filter((r) =>
				r.validationIssues.some((i) => i.severity === "error"),
			).length,
			withDeadUrls: deadUrls.length,
		},
	};

	// Write to data/health.json
	const healthDir = path.resolve(dataDir, "..");
	if (!fs.existsSync(healthDir)) fs.mkdirSync(healthDir, { recursive: true });
	const healthPath = path.join(healthDir, "health.json");
	fs.writeFileSync(healthPath, JSON.stringify(manifest, null, 2));

	return manifest;
}

// ---------------------------------------------------------------------------
// Offline embed stripping
// ---------------------------------------------------------------------------

export function stripOfflineEmbeds(dataDir: string, slug: string): boolean {
	const filePath = getDataFilePath(dataDir, slug);
	if (!fs.existsSync(filePath)) return false;

	try {
		const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		if (!Array.isArray(data.folders)) return false;

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
				folder.embedUrl = "";
				modified = true;
			}
			if (folder.pdfUrl && /publitas\.com|folderz\.be/i.test(folder.pdfUrl)) {
				folder.pdfUrl = "";
				modified = true;
			}
		}

		if (modified) {
			fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
		}

		return modified;
	} catch {
		return false;
	}
}
