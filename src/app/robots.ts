import { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
	const baseUrl = getSiteBaseUrl();
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: ["/out/"],
		},
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
