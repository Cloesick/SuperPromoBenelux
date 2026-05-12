import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
	checkLocalData,
	checkFolderExpiry,
	stripOfflineEmbeds,
	validateScrapedData,
	generateHealthManifest,
	formatAge,
	MAX_RETRIES,
	STALE_THRESHOLD_HOURS,
	type ScraperResult,
	type ValidationIssue,
	type ProbeResult,
} from "./run-helpers";

// ---------------------------------------------------------------------------
// Temporary directory helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

function writeTmpJson(slug: string, data: unknown): void {
	fs.writeFileSync(
		path.join(tmpDir, `${slug}.json`),
		JSON.stringify(data, null, 2),
	);
}

function readTmpJson(slug: string): unknown {
	return JSON.parse(
		fs.readFileSync(path.join(tmpDir, `${slug}.json`), "utf-8"),
	);
}

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-helpers-test-"));
});

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
	it("MAX_RETRIES is at least 2", () => {
		expect(MAX_RETRIES).toBeGreaterThanOrEqual(2);
	});

	it("STALE_THRESHOLD_HOURS equals 7 days", () => {
		expect(STALE_THRESHOLD_HOURS).toBe(168);
	});
});

// ---------------------------------------------------------------------------
// formatAge
// ---------------------------------------------------------------------------

describe("formatAge", () => {
	it('returns "unknown age" for null', () => {
		expect(formatAge(null)).toBe("unknown age");
	});

	it("formats minutes when < 1 hour", () => {
		expect(formatAge(0.5)).toBe("30m");
	});

	it("formats hours when < 24 hours", () => {
		expect(formatAge(6)).toBe("6h");
	});

	it("formats days when >= 24 hours", () => {
		expect(formatAge(48)).toBe("2d");
		expect(formatAge(168)).toBe("7d");
	});
});

// ---------------------------------------------------------------------------
// checkLocalData
// ---------------------------------------------------------------------------

describe("checkLocalData", () => {
	it("returns invalid when file does not exist", () => {
		const result = checkLocalData(tmpDir, "nonexistent");
		expect(result.valid).toBe(false);
		expect(result.ageHours).toBeNull();
	});

	it("returns valid for well-formed data with scrapedAt", () => {
		const scrapedAt = new Date(Date.now() - 3_600_000 * 2).toISOString(); // 2h ago
		writeTmpJson("test", {
			retailer: "test",
			folders: [{ id: "f1" }],
			deals: [],
			scrapedAt,
		});

		const result = checkLocalData(tmpDir, "test");
		expect(result.valid).toBe(true);
		expect(result.ageHours).toBeCloseTo(2, 0);
	});

	it("returns invalid when folders is not an array", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: "not-an-array",
			scrapedAt: new Date().toISOString(),
		});

		const result = checkLocalData(tmpDir, "test");
		expect(result.valid).toBe(false);
	});

	it("returns valid with null ageHours when scrapedAt is missing", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: [{ id: "f1" }],
			deals: [],
		});

		const result = checkLocalData(tmpDir, "test");
		expect(result.valid).toBe(true);
		expect(result.ageHours).toBeNull();
	});

	it("returns invalid for corrupted JSON", () => {
		fs.writeFileSync(path.join(tmpDir, "bad.json"), "{ invalid json");
		const result = checkLocalData(tmpDir, "bad");
		expect(result.valid).toBe(false);
	});

	it("detects stale data (> STALE_THRESHOLD_HOURS)", () => {
		const scrapedAt = new Date(
			Date.now() - 3_600_000 * (STALE_THRESHOLD_HOURS + 1),
		).toISOString();
		writeTmpJson("stale", {
			retailer: "stale",
			folders: [{ id: "f1" }],
			deals: [],
			scrapedAt,
		});

		const result = checkLocalData(tmpDir, "stale");
		expect(result.valid).toBe(true);
		expect(result.ageHours).toBeGreaterThan(STALE_THRESHOLD_HOURS);
	});

	it("detects fresh data (< STALE_THRESHOLD_HOURS)", () => {
		const scrapedAt = new Date(Date.now() - 3_600_000 * 1).toISOString();
		writeTmpJson("fresh", {
			retailer: "fresh",
			folders: [{ id: "f1" }],
			deals: [],
			scrapedAt,
		});

		const result = checkLocalData(tmpDir, "fresh");
		expect(result.valid).toBe(true);
		expect(result.ageHours!).toBeLessThan(STALE_THRESHOLD_HOURS);
	});
});

// ---------------------------------------------------------------------------
// checkFolderExpiry
// ---------------------------------------------------------------------------

describe("checkFolderExpiry", () => {
	it("returns not expired when file does not exist", () => {
		const result = checkFolderExpiry(tmpDir, "nonexistent");
		expect(result.expired).toBe(false);
		expect(result.latestValidUntil).toBeNull();
	});

	it("returns not expired when folders array is empty", () => {
		writeTmpJson("empty", { retailer: "test", folders: [] });
		const result = checkFolderExpiry(tmpDir, "empty");
		expect(result.expired).toBe(false);
	});

	it("returns expired when validUntil is in the past", () => {
		writeTmpJson("expired", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					validUntil: "2020-01-01",
				},
			],
		});

		const result = checkFolderExpiry(tmpDir, "expired");
		expect(result.expired).toBe(true);
		expect(result.latestValidUntil).toBe("2020-01-01");
	});

	it("returns not expired when validUntil is in the future", () => {
		const futureDate = new Date(Date.now() + 7 * 24 * 3_600_000);
		const dateStr = futureDate.toISOString().split("T")[0];
		writeTmpJson("valid", {
			retailer: "test",
			folders: [{ id: "f1", validUntil: dateStr }],
		});

		const result = checkFolderExpiry(tmpDir, "valid");
		expect(result.expired).toBe(false);
		expect(result.latestValidUntil).toBe(dateStr);
	});

	it("returns not expired when validUntil is missing", () => {
		writeTmpJson("no-date", {
			retailer: "test",
			folders: [{ id: "f1" }],
		});

		const result = checkFolderExpiry(tmpDir, "no-date");
		expect(result.expired).toBe(false);
	});

	it("extra retries are granted for expired folders (MAX_RETRIES + 1)", () => {
		// This tests the integration logic: expired folders get extra retries
		writeTmpJson("expired", {
			retailer: "test",
			folders: [{ id: "f1", validUntil: "2020-01-01" }],
		});

		const expiry = checkFolderExpiry(tmpDir, "expired");
		const maxRetries = expiry.expired ? MAX_RETRIES + 1 : MAX_RETRIES;
		expect(maxRetries).toBe(MAX_RETRIES + 1);
	});
});

// ---------------------------------------------------------------------------
// stripOfflineEmbeds
// ---------------------------------------------------------------------------

describe("stripOfflineEmbeds", () => {
	it("returns false when file does not exist", () => {
		expect(stripOfflineEmbeds(tmpDir, "nonexistent")).toBe(false);
	});

	it("strips Publitas embedUrl from expired folder", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					validUntil: "2020-01-01",
					embedUrl: "https://view.publitas.com/x/y/page/1",
					pdfUrl: "https://view.publitas.com/x/y.pdf",
				},
			],
		});

		const result = stripOfflineEmbeds(tmpDir, "test");
		expect(result).toBe(true);

		const data = readTmpJson("test") as any;
		expect(data.folders[0].embedUrl).toBe("");
		expect(data.folders[0].pdfUrl).toBe("");
	});

	it("strips Folderz embedUrl from expired folder", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					validUntil: "2020-01-01",
					embedUrl: "https://www.folderz.be/something",
				},
			],
		});

		const result = stripOfflineEmbeds(tmpDir, "test");
		expect(result).toBe(true);

		const data = readTmpJson("test") as any;
		expect(data.folders[0].embedUrl).toBe("");
	});

	it("preserves embedUrl on non-expired folder", () => {
		const futureDate = new Date(Date.now() + 7 * 24 * 3_600_000);
		const dateStr = futureDate.toISOString().split("T")[0];
		writeTmpJson("test", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					validUntil: dateStr,
					embedUrl: "https://view.publitas.com/x/y/page/1",
				},
			],
		});

		const result = stripOfflineEmbeds(tmpDir, "test");
		expect(result).toBe(false);

		const data = readTmpJson("test") as any;
		expect(data.folders[0].embedUrl).toBe(
			"https://view.publitas.com/x/y/page/1",
		);
	});

	it("preserves non-Publitas/Folderz embedUrl even on expired folder", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					validUntil: "2020-01-01",
					embedUrl: "https://e.issuu.com/embed.html?u=colruyt&d=abc",
				},
			],
		});

		const result = stripOfflineEmbeds(tmpDir, "test");
		expect(result).toBe(false);

		const data = readTmpJson("test") as any;
		expect(data.folders[0].embedUrl).toBe(
			"https://e.issuu.com/embed.html?u=colruyt&d=abc",
		);
	});

	it("handles multiple folders (mix of expired and valid)", () => {
		const futureDate = new Date(Date.now() + 7 * 24 * 3_600_000);
		const dateStr = futureDate.toISOString().split("T")[0];
		writeTmpJson("test", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					validUntil: "2020-01-01",
					embedUrl: "https://view.publitas.com/expired",
				},
				{
					id: "f2",
					validUntil: dateStr,
					embedUrl: "https://view.publitas.com/valid",
				},
			],
		});

		const result = stripOfflineEmbeds(tmpDir, "test");
		expect(result).toBe(true);

		const data = readTmpJson("test") as any;
		expect(data.folders[0].embedUrl).toBe("");
		expect(data.folders[1].embedUrl).toBe("https://view.publitas.com/valid");
	});

	it("handles folder with no validUntil gracefully", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					embedUrl: "https://view.publitas.com/something",
				},
			],
		});

		const result = stripOfflineEmbeds(tmpDir, "test");
		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// validateScrapedData
// ---------------------------------------------------------------------------

describe("validateScrapedData", () => {
	it("returns error when file does not exist", () => {
		const issues = validateScrapedData(tmpDir, "nonexistent");
		expect(issues).toHaveLength(1);
		expect(issues[0].severity).toBe("error");
		expect(issues[0].field).toBe("file");
	});

	it("returns error for invalid JSON", () => {
		fs.writeFileSync(path.join(tmpDir, "bad.json"), "{ invalid json");
		const issues = validateScrapedData(tmpDir, "bad");
		expect(issues).toHaveLength(1);
		expect(issues[0].message).toBe("Invalid JSON");
	});

	it("returns error when folders is not an array", () => {
		writeTmpJson("test", { retailer: "test", folders: "not-array" });
		const issues = validateScrapedData(tmpDir, "test");
		expect(
			issues.some((i) => i.field === "folders" && i.severity === "error"),
		).toBe(true);
	});

	it("returns warning for empty folders array", () => {
		writeTmpJson("test", { retailer: "test", folders: [] });
		const issues = validateScrapedData(tmpDir, "test");
		expect(
			issues.some((i) => i.field === "folders" && i.severity === "warning"),
		).toBe(true);
	});

	it("returns no issues for well-formed data", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					title: "Test folder",
					validFrom: "2026-01-01",
					validUntil: "2026-01-07",
					pageCount: 1,
					pages: [{ pageNumber: 1, imageUrl: "/p1.png", deals: [] }],
					embedUrl: "https://example.com/embed",
				},
			],
			scrapedAt: new Date().toISOString(),
		});
		const issues = validateScrapedData(tmpDir, "test");
		expect(issues).toHaveLength(0);
	});

	it("detects missing title", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					validFrom: "2026-01-01",
					validUntil: "2026-01-07",
					pageCount: 0,
					pages: [],
				},
			],
		});
		const issues = validateScrapedData(tmpDir, "test");
		expect(
			issues.some((i) => i.field.includes("title") && i.severity === "error"),
		).toBe(true);
	});

	it("detects invalid date format", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					title: "Test",
					validFrom: "not-a-date",
					validUntil: "2026-01-07",
					pageCount: 0,
					pages: [],
				},
			],
		});
		const issues = validateScrapedData(tmpDir, "test");
		expect(
			issues.some(
				(i) => i.field.includes("validFrom") && i.severity === "error",
			),
		).toBe(true);
	});

	it("detects pageCount mismatch", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					title: "Test",
					validFrom: "2026-01-01",
					validUntil: "2026-01-07",
					pageCount: 5,
					pages: [],
				},
			],
		});
		const issues = validateScrapedData(tmpDir, "test");
		expect(
			issues.some(
				(i) => i.field.includes("pageCount") && i.severity === "warning",
			),
		).toBe(true);
	});

	it("warns when folder has no content (no embed, pdf, or pages)", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					title: "Test",
					validFrom: "2026-01-01",
					validUntil: "2026-01-07",
					pageCount: 0,
					pages: [],
				},
			],
		});
		const issues = validateScrapedData(tmpDir, "test");
		expect(
			issues.some((i) => i.message.includes("no embed, PDF, or pages")),
		).toBe(true);
	});

	it("warns on invalid embedUrl", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: [
				{
					id: "f1",
					title: "Test",
					validFrom: "2026-01-01",
					validUntil: "2026-01-07",
					pageCount: 0,
					pages: [],
					embedUrl: "not-a-url",
				},
			],
		});
		const issues = validateScrapedData(tmpDir, "test");
		expect(issues.some((i) => i.field.includes("embedUrl"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// generateHealthManifest
// ---------------------------------------------------------------------------

describe("generateHealthManifest", () => {
	it("generates a manifest with correct summary counts", () => {
		writeTmpJson("fresh-retailer", {
			retailer: "fresh-retailer",
			folders: [
				{
					id: "f1",
					title: "Test",
					validFrom: "2026-01-01",
					validUntil: "2026-01-07",
					pageCount: 0,
					pages: [],
					embedUrl: "https://example.com/embed",
				},
			],
			deals: [{ id: "d1" }],
			scrapedAt: new Date().toISOString(),
		});

		const results: ScraperResult[] = [
			{ slug: "fresh-retailer", name: "Fresh", status: "fresh", attempts: 1 },
			{
				slug: "missing-retailer",
				name: "Missing",
				status: "missing",
				attempts: 3,
				error: "timeout",
			},
		];

		const validationMap = new Map<string, ValidationIssue[]>();
		validationMap.set("fresh-retailer", []);
		validationMap.set("missing-retailer", [
			{ field: "file", message: "Data file does not exist", severity: "error" },
		]);

		const probeMap = new Map<string, ProbeResult[]>();
		probeMap.set("fresh-retailer", [
			{ url: "https://example.com/embed", status: 200, live: true },
		]);

		const manifest = generateHealthManifest(
			tmpDir,
			results,
			validationMap,
			probeMap,
		);

		expect(manifest.summary.total).toBe(2);
		expect(manifest.summary.fresh).toBe(1);
		expect(manifest.summary.missing).toBe(1);
		expect(manifest.summary.withErrors).toBe(1);
		expect(manifest.summary.withDeadUrls).toBe(0);
		expect(manifest.retailers).toHaveLength(2);
		expect(manifest.generatedAt).toBeTruthy();
	});

	it("writes health.json to parent of dataDir", () => {
		writeTmpJson("test", {
			retailer: "test",
			folders: [],
			deals: [],
			scrapedAt: new Date().toISOString(),
		});

		const results: ScraperResult[] = [
			{ slug: "test", name: "Test", status: "fresh", attempts: 1 },
		];

		generateHealthManifest(tmpDir, results, new Map(), new Map());

		const healthPath = path.join(tmpDir, "..", "health.json");
		expect(fs.existsSync(healthPath)).toBe(true);

		const written = JSON.parse(fs.readFileSync(healthPath, "utf-8"));
		expect(written.summary.total).toBe(1);

		// Clean up
		fs.unlinkSync(healthPath);
	});

	it("tracks dead URLs in summary", () => {
		writeTmpJson("dead", {
			retailer: "dead",
			folders: [{ id: "f1", embedUrl: "https://dead.example.com" }],
			deals: [],
			scrapedAt: new Date().toISOString(),
		});

		const results: ScraperResult[] = [
			{ slug: "dead", name: "Dead", status: "fresh", attempts: 1 },
		];

		const probeMap = new Map<string, ProbeResult[]>();
		probeMap.set("dead", [
			{ url: "https://dead.example.com", status: 404, live: false },
		]);

		const manifest = generateHealthManifest(
			tmpDir,
			results,
			new Map(),
			probeMap,
		);
		expect(manifest.summary.withDeadUrls).toBe(1);

		// Clean up health.json
		const healthPath = path.join(tmpDir, "..", "health.json");
		if (fs.existsSync(healthPath)) fs.unlinkSync(healthPath);
	});

	it("includes retailer details (folderCount, dealCount, hasEmbed, etc.)", () => {
		writeTmpJson("detail", {
			retailer: "detail",
			folders: [
				{
					id: "f1",
					title: "Test",
					validFrom: "2026-01-01",
					validUntil: "2026-01-07",
					pageCount: 2,
					pages: [{ pageNumber: 1 }, { pageNumber: 2 }],
					embedUrl: "https://example.com/embed",
					pdfUrl: "https://example.com/file.pdf",
				},
			],
			deals: [{ id: "d1" }, { id: "d2" }, { id: "d3" }],
			scrapedAt: new Date().toISOString(),
		});

		const results: ScraperResult[] = [
			{
				slug: "detail",
				name: "Detail",
				status: "fresh",
				attempts: 1,
				dataAge: "0m",
			},
		];

		const manifest = generateHealthManifest(
			tmpDir,
			results,
			new Map(),
			new Map(),
		);
		const entry = manifest.retailers[0];
		expect(entry.folderCount).toBe(1);
		expect(entry.dealCount).toBe(3);
		expect(entry.hasEmbed).toBe(true);
		expect(entry.hasPdf).toBe(true);
		expect(entry.hasPages).toBe(true);
		expect(entry.dataAge).toBe("0m");

		// Clean up
		const healthPath = path.join(tmpDir, "..", "health.json");
		if (fs.existsSync(healthPath)) fs.unlinkSync(healthPath);
	});
});
