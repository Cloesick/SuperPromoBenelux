export type Vertical =
	| "general"
	| "pet"
	| "electro"
	| "fashion"
	| "home-garden"
	| "beauty"
	| "diy";

export const VERTICALS: Vertical[] = [
	"general",
	"pet",
	"electro",
	"fashion",
	"home-garden",
	"beauty",
	"diy",
];

export interface VerticalConfig {
	slug: Vertical;
	name: string;
	description: string;
	color: string;
	pathPrefix: string;
}

export const VERTICAL_CONFIGS: Record<Vertical, VerticalConfig> = {
	general: {
		slug: "general",
		name: "SuperPromo",
		description: "Supermarkten & discounters",
		color: "#2563EB",
		pathPrefix: "",
	},
	pet: {
		slug: "pet",
		name: "Pet SuperPromo",
		description: "Dierenwinkels & dierenspeciaalzaken",
		color: "#F97316",
		pathPrefix: "/pet",
	},
	electro: {
		slug: "electro",
		name: "Electro SuperPromo",
		description: "Elektronicazaken",
		color: "#0090E3",
		pathPrefix: "/electro",
	},
	fashion: {
		slug: "fashion",
		name: "Fashion SuperPromo",
		description: "Mode & kleding",
		color: "#E11D48",
		pathPrefix: "/fashion",
	},
	"home-garden": {
		slug: "home-garden",
		name: "Home & Garden SuperPromo",
		description: "Wonen, tuin & doe-het-zelf",
		color: "#16A34A",
		pathPrefix: "/home-garden",
	},
	beauty: {
		slug: "beauty",
		name: "Beauty SuperPromo",
		description: "Drogisterij, parfum & verzorging",
		color: "#EC4899",
		pathPrefix: "/beauty",
	},
	diy: {
		slug: "diy",
		name: "DIY SuperPromo",
		description: "Doe-het-zelf & bouwmarkten",
		color: "#F59E0B",
		pathPrefix: "/diy",
	},
};

export interface Retailer {
	slug: string;
	name: string;
	logo: string;
	color: string;
	website: string;
	description: string;
	affiliateUrl?: string;
	category: RetailerCategory;
	verticals: Vertical[];
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
	| "vrije-tijd"
	| "dierenwinkel"
	| "beauty"
	| "parfum"
	| "meubels"
	| "bouwmarkt";

export type ContentSource =
	| "publitas"
	| "ipaper"
	| "yumpu"
	| "issuu"
	| "pdf"
	| "html"
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
