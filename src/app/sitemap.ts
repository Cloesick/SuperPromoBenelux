import { MetadataRoute } from "next";
import { retailers } from "@/lib/retailers";
import { getScrapedAt } from "@/lib/folders";

const BASE_URL = "https://www.superpromobelgie.be";

export default function sitemap(): MetadataRoute.Sitemap {
  const retailerPages = retailers.map((r) => ({
    url: `${BASE_URL}/folders/${r.slug}`,
    lastModified: getScrapedAt(r.slug) ?? new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const latestScrape = retailerPages.reduce<Date>((latest, p) => {
    const d = p.lastModified instanceof Date ? p.lastModified : new Date(p.lastModified);
    return d > latest ? d : latest;
  }, new Date(0));

  return [
    {
      url: BASE_URL,
      lastModified: latestScrape.getTime() > 0 ? latestScrape : new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/folders`,
      lastModified: latestScrape.getTime() > 0 ? latestScrape : new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...retailerPages,
    {
      url: `${BASE_URL}/veelgestelde-vragen`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/over-ons`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
