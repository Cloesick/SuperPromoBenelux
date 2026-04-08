import { MetadataRoute } from "next";
import { retailers } from "@/lib/retailers";
import { getScrapedAt } from "@/lib/folders";
import { getSiteBaseUrl } from "@/lib/site";

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
