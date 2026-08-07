import { MetadataRoute } from "next";
import { retailers } from "@/lib/retailers";
import { getCurrentFolder, getScrapedAt } from "@/lib/folders";
import { isFolderIndexable } from "@/lib/folderRenderability";
import { getSiteBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = getSiteBaseUrl();
	// Only submit folder pages that actually render something. This is the same
	// predicate the page itself uses to decide `robots: noindex`, so the two can
	// never disagree — a URL in the sitemap is always one we want indexed.
	//
	// The `?? new Date()` fallback is deliberately gone: it stamped *today* on
	// exactly the pages with no scraped data, giving the emptiest pages the
	// strongest freshness signal on the site.
	const retailerPages = retailers
		.map((r) => ({ retailer: r, folder: getCurrentFolder(r.slug), scrapedAt: getScrapedAt(r.slug) }))
		.filter(({ retailer, folder }) => isFolderIndexable(folder, retailer.slug))
		.filter(({ scrapedAt }) => scrapedAt !== null)
		.map(({ retailer, scrapedAt }) => ({
			url: `${baseUrl}/folders/${retailer.slug}`,
			lastModified: scrapedAt as Date,
			changeFrequency: "weekly" as const,
			priority: 0.8,
		}));

	const latestScrape = retailerPages.reduce<Date>((latest, p) => {
		const d =
			p.lastModified instanceof Date
				? p.lastModified
				: new Date(p.lastModified);
		return d > latest ? d : latest;
	}, new Date(0));

	const today = new Date().toISOString().split("T")[0];
	const staticPageDate = "2026-06-01";

	return [
		{
			url: baseUrl,
			lastModified: today,
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
			url: `${baseUrl}/nl-grensstreek`,
			lastModified: today,
			changeFrequency: "weekly",
			priority: 0.6,
		},
		{
			url: `${baseUrl}/veelgestelde-vragen`,
			lastModified: staticPageDate,
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{
			url: `${baseUrl}/over-ons`,
			lastModified: staticPageDate,
			changeFrequency: "monthly",
			priority: 0.3,
		},
		{
			url: `${baseUrl}/privacy`,
			lastModified: staticPageDate,
			changeFrequency: "yearly",
			priority: 0.2,
		},
		{
			url: `${baseUrl}/contact`,
			lastModified: staticPageDate,
			changeFrequency: "yearly",
			priority: 0.4,
		},
	];
}
