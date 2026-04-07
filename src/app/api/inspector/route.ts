import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type InspectorScraperConfig = {
	slug: string;
	folderUrls: string[];
	dealUrls: string[];
	cookieSelectors: string[];
	sourceFile: string;
};

type InspectorRetailer = {
	project: string;
	slug: string;
	name?: string;
	category?: string;
	website?: string;
	logo?: string;
	color?: string;
	scraper?: InspectorScraperConfig;
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

function parseRetailersTs(projectRoot: string, project: string): InspectorRetailer[] {
	const retailersPath = path.join(projectRoot, "src", "lib", "retailers.ts");
	const text = safeReadText(retailersPath);
	if (!text) return [];

	const retailers: InspectorRetailer[] = [];

	// Very lightweight parse: find each `slug: "..."` object and then pull a few common keys.
	const objRe = /\{\s*[\s\S]*?\bslug\s*:\s*"([^"]+)"[\s\S]*?\}/g;
	let m: RegExpExecArray | null;
	while ((m = objRe.exec(text))) {
		const objText = m[0];
		const slug = m[1];
		const name = objText.match(/\bname\s*:\s*"([^"]+)"/)?.[1];
		const category = objText.match(/\bcategory\s*:\s*"([^"]+)"/)?.[1];
		const website = objText.match(/\bwebsite\s*:\s*"([^"]+)"/)?.[1];
		const logo = objText.match(/\blogo\s*:\s*"([^"]+)"/)?.[1];
		const color = objText.match(/\bcolor\s*:\s*"([^"]+)"/)?.[1];

		retailers.push({
			project,
			slug,
			name,
			category,
			website,
			logo,
			color,
		});
	}

	return retailers;
}

function parseScraperConfigs(projectRoot: string): InspectorScraperConfig[] {
	const scrapersDir = path.join(projectRoot, "src", "scrapers");
	let files: string[] = [];
	try {
		files = fs.readdirSync(scrapersDir);
	} catch {
		return [];
	}

	const ignored = new Set([
		"base.ts",
		"run.ts",
		"monitor.ts",
		"scrapers.ts",
		"scrapers.test.ts",
		"index.ts",
	]);

	const configs: InspectorScraperConfig[] = [];
	for (const file of files) {
		if (!file.endsWith(".ts")) continue;
		if (ignored.has(file)) continue;

		const fullPath = path.join(scrapersDir, file);
		const text = safeReadText(fullPath);
		if (!text) continue;

		const slug = extractSlug(text);
		if (!slug) continue;

		const folderUrls = extractStringArray("folderUrls", text).filter((u) => u.startsWith("http"));
		const dealUrls = extractStringArray("dealUrls", text).filter((u) => u.startsWith("http"));
		const cookieSelectors = extractStringArray("cookieSelectors", text);

		configs.push({
			slug,
			folderUrls,
			dealUrls,
			cookieSelectors,
			sourceFile: file,
		});
	}

	return configs;
}

export async function GET() {
	const projectsRoot = path.resolve(process.cwd(), "..");
	const results: InspectorRetailer[] = [];

	for (const project of PROJECTS) {
		const projectRoot = path.join(projectsRoot, project);
		const retailers = parseRetailersTs(projectRoot, project);
		const scraperConfigs = parseScraperConfigs(projectRoot);
		const scraperBySlug = new Map(scraperConfigs.map((c) => [c.slug, c] as const));

		for (const r of retailers) {
			results.push({
				...r,
				scraper: scraperBySlug.get(r.slug),
			});
		}
	}

	return NextResponse.json({
		generatedAt: new Date().toISOString(),
		projects: PROJECTS,
		count: results.length,
		retailers: results,
	});
}
