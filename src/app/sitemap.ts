import { MetadataRoute } from "next";
import { retailers } from "@/lib/retailers";

const BASE_URL = "https://www.superpromobelgie.be";

export default function sitemap(): MetadataRoute.Sitemap {
  const retailerPages = retailers.map((r) => ({
    url: `${BASE_URL}/folders/${r.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/folders`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...retailerPages,
    {
      url: `${BASE_URL}/over-ons`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
