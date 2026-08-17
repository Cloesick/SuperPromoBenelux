import { MetadataRoute } from "next";
import { retailers } from "@/lib/retailers";
import { getCurrentFolder, getScrapedAt } from "@/lib/folders";
import { isFolderIndexable } from "@/lib/folderRenderability";
import { categories } from "@/lib/catalog";
import { getSiteBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = getSiteBaseUrl();
	// next.config.ts sets `trailingSlash: true`, so every route 308-redirects to
	// its slashed form and the canonical tag points there. Emitting the unslashed
	// URL turned all but one sitemap entry into a redirect, which Search Console
	// reports as "Page with redirect" and indexes nothing from. Build every URL
	// through here so the two can never drift apart again.
	const url = (path = "") => `${baseUrl}/${path}`;
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
		.map(({ retailer, folder, scrapedAt }) => ({
			url: url(`folders/${retailer.slug}/`),
			lastModified: scrapedAt as Date,
			changeFrequency: "weekly" as const,
			priority: 0.8,
			// Leaflet pages are the site's only original imagery, and "aldi folder"
			// is as often an image search as a web one. Without <image:image> entries
			// Google has to discover 798 blob-hosted images by crawling alone, and
			// they live on a different origin to the page that shows them.
			images: (folder?.pages ?? [])
				.map((page) => page.imageUrl)
				.filter((url): url is string => !!url)
				.map((url) => (url.startsWith("/") ? `${baseUrl}${url}` : url))
				// 1,000 images per URL is the sitemap limit; no leaflet approaches it,
				// but a runaway scrape should not produce an invalid sitemap.
				.slice(0, 1000),
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

	// The shop-category hub and its category pages render `index, follow` and
	// carry the commercial-intent queries ("supermarkt folder", "discounter
	// folder"), but were never submitted. They are static, so their freshness
	// tracks the newest scrape rather than a build date.
	const categoryPages = categories.map((category) => ({
		url: url(`winkels/${category.key}/`),
		lastModified: latestScrape.getTime() > 0 ? latestScrape : new Date(),
		changeFrequency: "weekly" as const,
		priority: 0.7,
	}));

	// /nl-grensstreek is deliberately `noindex, nofollow`, so it is not listed:
	// submitting a noindex URL earns a "Submitted URL marked 'noindex'" error
	// and spends crawl budget on a page we have told Google to drop.
	return [
		{
			url: url(),
			lastModified: today,
			changeFrequency: "daily",
			priority: 1,
		},
		{
			url: url("folders/"),
			lastModified: latestScrape.getTime() > 0 ? latestScrape : new Date(),
			changeFrequency: "daily",
			priority: 0.9,
		},
		...retailerPages,
		{
			url: url("winkels/"),
			lastModified: latestScrape.getTime() > 0 ? latestScrape : new Date(),
			changeFrequency: "weekly",
			priority: 0.8,
		},
		...categoryPages,
		{
			url: url("veelgestelde-vragen/"),
			lastModified: staticPageDate,
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{
			url: url("over-ons/"),
			lastModified: staticPageDate,
			changeFrequency: "monthly",
			priority: 0.3,
		},
		{
			url: url("privacy/"),
			lastModified: staticPageDate,
			changeFrequency: "yearly",
			priority: 0.2,
		},
		{
			url: url("contact/"),
			lastModified: staticPageDate,
			changeFrequency: "yearly",
			priority: 0.4,
		},
	];
}
