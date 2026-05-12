export interface Retailer {
	slug: string;
	name: string;
	logo: string;
	color: string;
	website: string;
	description: string;
	affiliateUrl?: string;
	category: RetailerCategory;
	seo: RetailerSeo;
}

export interface RetailerSeo {
	folderDay: string;
	folderDayDetail: string;
	storeCount: string;
	pricePositioning: string;
	loyalty: string;
	appName?: string;
	openingHours: string;
	priceGuarantee?: string;
	uniqueSellingPoint: string;
}

export type RetailerCategory =
	| "supermarkt"
	| "discounter"
	| "warenhuis"
	| "electronica"
	| "doe-het-zelf"
	| "drogist"
	| "mode"
	| "vrije-tijd";

export type ContentSource =
	| "publitas"
	| "ipaper"
	| "yumpu"
	| "issuu"
	| "pdf"
	| "pdf-text"
	| "html"
	| "page-text"
	| "screenshot"
	| "api"
	| "unknown";

export interface Folder {
	id: string;
	retailerSlug: string;
	title: string;
	validFrom: string;
	validUntil: string;
	pageCount: number;
	thumbnailUrl: string;
	pages: FolderPage[];
	embedUrl?: string;
	pdfUrl?: string;
	contentSource: ContentSource;
	scrapedAt: string;
}

export interface FolderPage {
	pageNumber: number;
	imageUrl: string;
	deals: Deal[];
}

export interface Deal {
	id: string;
	product: string;
	originalPrice?: number;
	promoPrice?: number;
	discount?: string;
	description?: string;
	category?: string;
	imageUrl?: string;
	affiliateUrl?: string;
	validFrom: string;
	validUntil: string;
	retailerSlug: string;
}

export interface ScrapedData {
	retailer: string;
	folders: Folder[];
	deals: Deal[];
	scrapedAt: string;
	sourceUrls: string[];
	methods: ContentSource[];
}
