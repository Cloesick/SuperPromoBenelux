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

export interface VerticalTheme {
	gradient: string;
	accentColor: string;
	accentHover: string;
	accentBg: string;
	headerBg: string;
	headerText: string;
	footerBg: string;
}

export interface VerticalConfig {
	slug: Vertical;
	name: string;
	shortName: string;
	description: string;
	tagline: string;
	color: string;
	pathPrefix: string;
	icon: string;
	facebookUrl?: string;
	theme: VerticalTheme;
}

export const VERTICAL_CONFIGS: Record<Vertical, VerticalConfig> = {
	general: {
		slug: "general",
		name: "SuperPromo België",
		shortName: "SuperPromo",
		description: "Supermarkten & discounters",
		tagline: "Alle folders en promoties van je favoriete winkels",
		color: "#2563EB",
		pathPrefix: "",
		icon: "🛒",
		facebookUrl: "https://www.facebook.com/groups/superpromobelgie",
		theme: {
			gradient: "from-blue-700 via-blue-800 to-blue-900",
			accentColor: "text-blue-700",
			accentHover: "hover:text-blue-700",
			accentBg: "bg-blue-700",
			headerBg: "bg-white",
			headerText: "text-blue-700",
			footerBg: "bg-gray-900",
		},
	},
	pet: {
		slug: "pet",
		name: "Pet SuperPromo",
		shortName: "Pet",
		description: "Dierenwinkels & dierenspeciaalzaken",
		tagline: "De beste deals voor jouw huisdier",
		color: "#F97316",
		pathPrefix: "/pet",
		icon: "🐾",
		theme: {
			gradient: "from-orange-500 via-orange-600 to-amber-700",
			accentColor: "text-orange-600",
			accentHover: "hover:text-orange-600",
			accentBg: "bg-orange-600",
			headerBg: "bg-orange-50",
			headerText: "text-orange-700",
			footerBg: "bg-orange-950",
		},
	},
	electro: {
		slug: "electro",
		name: "Electro SuperPromo",
		shortName: "Electro",
		description: "Elektronicazaken",
		tagline: "Scherpe deals op elektronica en huishoudtoestellen",
		color: "#0090E3",
		pathPrefix: "/electro",
		icon: "⚡",
		theme: {
			gradient: "from-sky-600 via-blue-700 to-indigo-800",
			accentColor: "text-sky-600",
			accentHover: "hover:text-sky-600",
			accentBg: "bg-sky-600",
			headerBg: "bg-sky-50",
			headerText: "text-sky-700",
			footerBg: "bg-slate-900",
		},
	},
	fashion: {
		slug: "fashion",
		name: "Fashion SuperPromo",
		shortName: "Fashion",
		description: "Mode & kleding",
		tagline: "Promoties op mode, schoenen en accessoires",
		color: "#E11D48",
		pathPrefix: "/fashion",
		icon: "👗",
		theme: {
			gradient: "from-rose-600 via-pink-700 to-fuchsia-800",
			accentColor: "text-rose-600",
			accentHover: "hover:text-rose-600",
			accentBg: "bg-rose-600",
			headerBg: "bg-rose-50",
			headerText: "text-rose-700",
			footerBg: "bg-rose-950",
		},
	},
	"home-garden": {
		slug: "home-garden",
		name: "Home & Garden SuperPromo",
		shortName: "Home & Garden",
		description: "Wonen, tuin & doe-het-zelf",
		tagline: "Deals op meubels, interieur en tuinproducten",
		color: "#16A34A",
		pathPrefix: "/home-garden",
		icon: "🏡",
		theme: {
			gradient: "from-green-600 via-emerald-700 to-teal-800",
			accentColor: "text-green-600",
			accentHover: "hover:text-green-600",
			accentBg: "bg-green-600",
			headerBg: "bg-green-50",
			headerText: "text-green-700",
			footerBg: "bg-green-950",
		},
	},
	beauty: {
		slug: "beauty",
		name: "Beauty SuperPromo",
		shortName: "Beauty",
		description: "Drogisterij, parfum & verzorging",
		tagline: "Kortingen op beauty, parfum en verzorging",
		color: "#EC4899",
		pathPrefix: "/beauty",
		icon: "💄",
		theme: {
			gradient: "from-pink-500 via-fuchsia-600 to-purple-700",
			accentColor: "text-pink-600",
			accentHover: "hover:text-pink-600",
			accentBg: "bg-pink-600",
			headerBg: "bg-pink-50",
			headerText: "text-pink-700",
			footerBg: "bg-pink-950",
		},
	},
	diy: {
		slug: "diy",
		name: "DIY SuperPromo",
		shortName: "DIY",
		description: "Doe-het-zelf & bouwmarkten",
		tagline: "Promoties op gereedschap en bouwmaterialen",
		color: "#F59E0B",
		pathPrefix: "/diy",
		icon: "🔨",
		theme: {
			gradient: "from-amber-500 via-yellow-600 to-orange-700",
			accentColor: "text-amber-600",
			accentHover: "hover:text-amber-600",
			accentBg: "bg-amber-600",
			headerBg: "bg-amber-50",
			headerText: "text-amber-700",
			footerBg: "bg-amber-950",
		},
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
