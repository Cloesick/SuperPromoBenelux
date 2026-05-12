import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type CheckResult = {
	project: string;
	slug: string;
	hasScraper: boolean;
	hasFolderUrls: boolean;
	hasDataFile: boolean;
	folderCount: number;
	hasCurrentFolder: boolean;
	renderable: boolean;
	contentSource?: string;
	dealCount: number;
	failing: boolean;
	failureReasons: string[];
	methods?: string[];
	scrapedAt?: string;
	filePath?: string;
};

type InspectorDataFile = {
	folders?: unknown;
	deals?: unknown;
	methods?: unknown;
	scrapedAt?: unknown;
};

const PROJECTS = [
	"Superpromobelgiebram",
	"BeautySuperPromoBeneluxBram",
	"ElectroSuperPromoBeneluxBram",
	"PetSuperPromoBelgiumBram",
	"FashionSuperPromoBeneluxBram",
	"HomeGardenSuperPromoBeneluxBram",
	"DIYSuperpromoBelgiumBram",
] as const;

function safeReadJson(filePath: string): unknown | null {
	try {
		const raw = fs.readFileSync(filePath, "utf-8");
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function safeReadText(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
}

function extractStringArray(propName: string, content: string): string[] {
	const re = new RegExp(`${propName}\\s*:\\s*\\[([\\s\\S]*?)\\]`, "m");
	const m = content.match(re);
	if (!m) return [];
	const block = m[1] ?? "";
	const results: string[] = [];
	const strRe = /"([^"]+)"/g;
	let sm: RegExpExecArray | null;
	while ((sm = strRe.exec(block))) {
		results.push(sm[1]);
	}
	return results;
}

function extractSlug(content: string): string | null {
	const m = content.match(/\bslug\s*:\s*"([^"]+)"/);
	return m?.[1] ?? null;
}

function parseRetailerSlugs(projectRoot: string): string[] {
	const retailersPath = path.join(projectRoot, "src", "lib", "retailers.ts");
	const text = safeReadText(retailersPath);
	if (!text) return [];

	const slugs: string[] = [];
	const re = /\bslug\s*:\s*"([^"]+)"/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text))) {
		slugs.push(m[1]);
	}
	return Array.from(new Set(slugs));
}

function parseScraperBasics(
	projectRoot: string,
): Map<string, { hasScraper: boolean; hasFolderUrls: boolean }> {
	const scrapersDir = path.join(projectRoot, "src", "scrapers");
	let files: string[] = [];
	try {
		files = fs.readdirSync(scrapersDir);
	} catch {
		return new Map();
	}

	const ignored = new Set([
		"base.ts",
		"run.ts",
		"monitor.ts",
		"scrapers.ts",
		"scrapers.test.ts",
		"index.ts",
	]);

	const map = new Map<
		string,
		{ hasScraper: boolean; hasFolderUrls: boolean }
	>();
	for (const file of files) {
		if (!file.endsWith(".ts")) continue;
		if (ignored.has(file)) continue;

		const fullPath = path.join(scrapersDir, file);
		const text = safeReadText(fullPath);
		if (!text) continue;

		const slug = extractSlug(text);
		if (!slug) continue;

		const folderUrls = extractStringArray("folderUrls", text).filter((u) =>
			u.startsWith("http"),
		);
		map.set(slug, { hasScraper: true, hasFolderUrls: folderUrls.length > 0 });
	}

	return map;
}

function pickCurrentFolder(data: InspectorDataFile): unknown | null {
	const folders: unknown[] = Array.isArray(data?.folders)
		? (data.folders as unknown[])
		: [];
	if (folders.length === 0) return null;

	const now = new Date();
	const current = folders.find((f) => {
		if (typeof f !== "object" || !f) return false;
		const ff = f as Record<string, unknown>;
		const from = new Date(String(ff.validFrom ?? ""));
		const until = new Date(String(ff.validUntil ?? ""));
		if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime()))
			return false;
		return now >= from && now <= until;
	});
	return current ?? folders[0];
}

function isRenderableFolder(folder: unknown): boolean {
	if (!folder || typeof folder !== "object") return false;
	const f = folder as Record<string, unknown>;
	if (typeof f.embedUrl === "string" && f.embedUrl.length > 0) return true;
	if (typeof f.pdfUrl === "string" && f.pdfUrl.length > 0) return true;
	if (Array.isArray(f.pages) && f.pages.length > 0) return true;
	return false;
}

function hasProductLikeContent(currentFolder: unknown): boolean {
	// Option A: consider the folder itself as the "product" surface.
	// If we can render the folder (embed/pdf/pages), the website still offers product-like browsing.
	return isRenderableFolder(currentFolder);
}

export async function GET(request: Request) {
	const url = new URL(request.url);
	const requireDealsFlag = url.searchParams.get("requireDeals") === "1";

	const projectsRoot = path.resolve(process.cwd(), "..");
	const checks: CheckResult[] = [];

	for (const project of PROJECTS) {
		const projectRoot = path.join(projectsRoot, project);
		const slugs = parseRetailerSlugs(projectRoot);
		const scraperBasics = parseScraperBasics(projectRoot);

		for (const slug of slugs) {
			const basics = scraperBasics.get(slug);
			const dataDir = path.join(projectRoot, "data", "folders");
			const filePath = path.join(dataDir, `${slug}.json`);
			const raw = fs.existsSync(filePath) ? safeReadJson(filePath) : null;
			const json: InspectorDataFile | null =
				raw && typeof raw === "object" ? (raw as InspectorDataFile) : null;

			const folders: unknown[] = Array.isArray(json?.folders)
				? (json.folders as unknown[])
				: [];
			const deals: unknown[] = Array.isArray(json?.deals)
				? (json.deals as unknown[])
				: [];
			const currentFolder = json ? pickCurrentFolder(json) : null;
			const failureReasons: string[] = [];
			if (!basics?.hasScraper) failureReasons.push("missing_scraper");
			if (!basics?.hasFolderUrls) failureReasons.push("missing_folder_urls");
			if (!json) failureReasons.push("missing_data_file");
			if (folders.length === 0) failureReasons.push("no_folders");
			if (!currentFolder) failureReasons.push("no_current_folder");
			if (currentFolder && !isRenderableFolder(currentFolder))
				failureReasons.push("folder_not_renderable");
			if (
				requireDealsFlag &&
				deals.length === 0 &&
				!hasProductLikeContent(currentFolder)
			)
				failureReasons.push("no_products");
			const failing = failureReasons.length > 0;

			checks.push({
				project,
				slug,
				hasScraper: Boolean(basics?.hasScraper),
				hasFolderUrls: Boolean(basics?.hasFolderUrls),
				hasDataFile: Boolean(json),
				folderCount: folders.length,
				hasCurrentFolder: Boolean(currentFolder),
				renderable: isRenderableFolder(currentFolder),
				contentSource: (() => {
					if (!currentFolder || typeof currentFolder !== "object")
						return undefined;
					const f = currentFolder as Record<string, unknown>;
					return typeof f.contentSource === "string"
						? f.contentSource
						: undefined;
				})(),
				dealCount: deals.length,
				failing,
				failureReasons,
				methods: Array.isArray(json?.methods)
					? (json.methods as unknown[] as string[])
					: undefined,
				scrapedAt:
					typeof json?.scrapedAt === "string" ? json.scrapedAt : undefined,
				filePath: fs.existsSync(filePath) ? filePath : undefined,
			});
		}
	}

	const failing = checks.filter((c) => c.failing);

	return NextResponse.json({
		generatedAt: new Date().toISOString(),
		projects: PROJECTS,
		requireDeals: requireDealsFlag,
		count: checks.length,
		failingCount: failing.length,
		checks,
	});
}
