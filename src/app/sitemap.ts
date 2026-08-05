import fs from "node:fs";
import path from "node:path";
import { MetadataRoute } from "next";
import { retailers } from "@/lib/retailers";
import { getScrapedAt, getCurrentFolder } from "@/lib/folders";
import { getSiteBaseUrl } from "@/lib/site";

/**
 * Retailers the last scrape flagged as broken.
 *
 * Renderability alone is not enough: Boots sits behind Imperva and its folder
 * holds twelve screenshots *of the bot-challenge page*, so it looks perfectly
 * renderable while containing no leaflet. The scrape run already detects this
 * and records it in the health manifest, so read that rather than re-deriving.
 */
function getBrokenSlugs(): Set<string> {
	try {
		const manifestPath = path.join(process.cwd(), "data", "health.json");
		if (!fs.existsSync(manifestPath)) return new Set();
		const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
			retailers?: {
				slug: string;
				validationIssues?: { severity: string }[];
			}[];
		};
		return new Set(
			(manifest.retailers ?? [])
				.filter((r) =>
					(r.validationIssues ?? []).some((i) => i.severity === "error"),
				)
				.map((r) => r.slug),
		);
	} catch {
		// A missing or malformed manifest must not empty the sitemap.
		return new Set();
	}
}

/**
 * A folder page is worth submitting only if it shows real leaflet content.
 * Retailers that render nothing — maxi-zoo has no data file — or that render a
 * bot challenge invite Google to index empty pages.
 */
function isWorthIndexing(slug: string, broken: Set<string>): boolean {
	if (broken.has(slug)) return false;
	const folder = getCurrentFolder(slug);
	if (!folder) return false;
	const hasPages = Array.isArray(folder.pages) && folder.pages.length > 0;
	return hasPages || !!folder.embedUrl || !!folder.pdfUrl;
}

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = getSiteBaseUrl();
	// Drop retailers that render nothing, and those with no scrape timestamp.
	// The previous `?? new Date()` fallback stamped today's date on exactly the
	// retailers with no data, giving the emptiest pages the strongest freshness
	// signal in the whole sitemap.
	const broken = getBrokenSlugs();
	const retailerPages = retailers
		.flatMap((r) => {
			if (!isWorthIndexing(r.slug, broken)) return [];
			const scrapedAt = getScrapedAt(r.slug);
			if (!scrapedAt) return [];
			return [
				{
					url: `${baseUrl}/folders/${r.slug}`,
					lastModified: scrapedAt,
					changeFrequency: "weekly" as const,
					priority: 0.8,
				},
			];
		});

	const latestScrape = retailerPages.reduce<Date>((latest, p) => {
		const d =
			p.lastModified instanceof Date
				? p.lastModified
				: new Date(p.lastModified);
		return d > latest ? d : latest;
	}, new Date(0));

	return [
		{
			url: baseUrl,
			lastModified: latestScrape.getTime() > 0 ? latestScrape : new Date(),
			changeFrequency: "daily",
			priority: 1,
		},
		{
			url: `${baseUrl}/folders`,
			lastModified: latestScrape.getTime() > 0 ? latestScrape : new Date(),
			changeFrequency: "daily",
			priority: 0.9,
		},
		...retailerPages,
		{
			url: `${baseUrl}/veelgestelde-vragen`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{
			url: `${baseUrl}/over-ons`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.3,
		},
	];
}
