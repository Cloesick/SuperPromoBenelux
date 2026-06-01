import { MetadataRoute } from "next";
import { retailers } from "@/lib/retailers";
import { getScrapedAt } from "@/lib/folders";
import { getSiteBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = getSiteBaseUrl();
	const retailerPages = retailers.map((r) => ({
		url: `${baseUrl}/folders/${r.slug}`,
		lastModified: getScrapedAt(r.slug) ?? new Date(),
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
