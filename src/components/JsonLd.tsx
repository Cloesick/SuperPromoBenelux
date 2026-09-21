import { getSiteBaseUrl } from "@/lib/site";

interface JsonLdProps {
	data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
		/>
	);
}

export function createWebsiteJsonLd() {
	const baseUrl = getSiteBaseUrl();
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "SuperPromo België",
		url: baseUrl,
		description:
			"Bespaar elke dag op je boodschappen. Bekijk dagelijks de nieuwste folders van je favoriete winkels in België.",
		inLanguage: "nl-BE",
	};
}

export interface RetailerFolderJsonLdOptions {
	validFrom?: string;
	validUntil?: string;
	/** When the folder was last scraped — the page's real freshness signal. */
	scrapedAt?: string;
	/** Site-relative or absolute URL of the leaflet cover. */
	coverImageUrl?: string;
	/** How many leaflet pages this folder actually has. */
	pageCount?: number;
	/** The retailer's own site, so the page states who the folder belongs to. */
	retailerWebsite?: string;
}

/**
 * Structured data for a retailer's folder page.
 *
 * Leaflet content turns over weekly, so the two signals that matter most are
 * freshness and imagery: `dateModified` is what tells a crawler this week's
 * leaflet is not last week's, and the cover image is what earns a result in
 * image search — which is how a lot of people look for a folder.
 *
 * Everything here is derived from scraped data. Nothing is asserted when the
 * underlying value is missing, because a confident-but-wrong date is a worse
 * signal than no date.
 */
export function createRetailerFolderJsonLd(
	retailerName: string,
	slug: string,
	options: RetailerFolderJsonLdOptions = {},
) {
	const baseUrl = getSiteBaseUrl();
	const { validFrom, validUntil, scrapedAt, coverImageUrl, pageCount, retailerWebsite } =
		options;

	const absoluteCover = coverImageUrl?.startsWith("/")
		? `${baseUrl}${coverImageUrl}`
		: coverImageUrl;

	const validityText =
		validFrom && validUntil
			? ` Geldig van ${validFrom} tot ${validUntil}.`
			: "";

	return {
		"@context": "https://schema.org",
		"@type": "WebPage",
		name: `${retailerName} folder deze week`,
		url: `${baseUrl}/folders/${slug}`,
		description:
			`Bekijk de actuele ${retailerName} folder en ontdek de beste promoties van deze week in België.` +
			validityText,
		inLanguage: "nl-BE",
		...(validFrom && validUntil
			? { temporalCoverage: `${validFrom}/${validUntil}` }
			: {}),
		// Weekly content lives or dies on freshness. scrapedAt is the only
		// timestamp we can honestly claim, so it drives both fields.
		...(scrapedAt ? { datePublished: scrapedAt, dateModified: scrapedAt } : {}),
		...(absoluteCover
			? {
					primaryImageOfPage: {
						"@type": "ImageObject",
						contentUrl: absoluteCover,
						caption: `Voorpagina van de ${retailerName} folder`,
					},
				}
			: {}),
		...(typeof pageCount === "number" && pageCount > 0
			? {
					mainEntity: {
						"@type": "ItemList",
						name: `${retailerName} folderpagina's`,
						numberOfItems: pageCount,
					},
				}
			: {}),
		about: {
			"@type": "Organization",
			name: retailerName,
			...(retailerWebsite ? { url: retailerWebsite } : {}),
		},
		isPartOf: {
			"@type": "WebSite",
			name: "SuperPromo België",
			url: baseUrl,
		},
	};
}

/**
 * This week's folder offers as schema.org Products, from the cover analysis.
 *
 * Only offers with a printed price are included: an Offer without a price is
 * invalid, and a "1+1 gratis" with no number would have to be invented. Prices
 * are converted from the folder's "4,29" to schema.org's "4.29".
 */
export function createFolderOffersJsonLd(
	retailerName: string,
	slug: string,
	brief: {
		validFrom: string;
		validUntil: string;
		offers: { product: string; detail: string | null; priceNow: string | null; mechanic: string | null }[];
	},
) {
	const baseUrl = getSiteBaseUrl();
	const priced = brief.offers.filter((o) => o.priceNow && /^\d+([.,]\d{1,2})?$/.test(o.priceNow.trim()));
	if (priced.length === 0) return null;
	return {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: `Aanbiedingen in de ${retailerName} folder`,
		itemListElement: priced.map((o, i) => ({
			"@type": "ListItem",
			position: i + 1,
			item: {
				"@type": "Product",
				name: o.detail ? `${o.product} ${o.detail}` : o.product,
				...(o.mechanic ? { description: o.mechanic } : {}),
				offers: {
					"@type": "Offer",
					price: o.priceNow!.trim().replace(",", "."),
					priceCurrency: "EUR",
					validFrom: brief.validFrom,
					priceValidUntil: brief.validUntil,
					availability: "https://schema.org/InStoreOnly",
					url: `${baseUrl}/folders/${slug}`,
					seller: { "@type": "Organization", name: retailerName },
				},
			},
		})),
	};
}

export function createBreadcrumbJsonLd(items: { name: string; url: string }[]) {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: item.name,
			item: item.url,
		})),
	};
}

export function createFAQJsonLd(
	questions: { question: string; answer: string }[],
) {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: questions.map((q) => ({
			"@type": "Question",
			name: q.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: q.answer,
			},
		})),
	};
}
