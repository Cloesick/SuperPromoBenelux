// Exhaustive catalog of brick-and-mortar retail chains common in Belgium (BE)
// and the Netherlands (NL), grouped by shop type. Drives the /winkels directory
// hub. A shop becomes "live" (clickable to its folder) only once it's wired in
// retailers.ts + has scraped folder data; otherwise it shows as "binnenkort".
//
// `source` = the folder/leaflet platform, which decides scrape-feasibility:
//   "publitas" → scrapes cleanly (like AH/Delhaize/Action/Jumbo)
//   "issuu" | "ipaper" | "own" → custom viewer, needs the screenshot path
//   null → folder source not yet confirmed
//
// This is a directory dataset (lightweight); full Retailer entries (SEO, logo,
// actor viewerTemplate) live in retailers.ts and are added as each shop is
// activated.

export type ShopCategory =
	| "supermarkt"
	| "discounter"
	| "doe-het-zelf"
	| "tuin"
	| "dierenwinkel"
	| "drogist"
	| "electronica"
	| "mode"
	| "warenhuis"
	| "wonen"
	| "speelgoed"
	| "sport";

export type FolderSource = "publitas" | "issuu" | "ipaper" | "own" | null;
export type Country = "be" | "nl";

export interface CatalogShop {
	slug: string;
	name: string;
	category: ShopCategory;
	countries: Country[];
	website: string;
	color: string;
	source: FolderSource;
	/** true = wired in retailers.ts with folder data; false = directory only. */
	live?: boolean;
}

export interface CategoryMeta {
	key: ShopCategory;
	label: string;
	/** Dutch one-liner for the category landing page. */
	blurb: string;
	icon: string; // lucide-react icon name
}

export const categories: CategoryMeta[] = [
	{
		key: "supermarkt",
		label: "Supermarkten",
		blurb: "Wekelijkse folders en promoties van alle grote supermarkten in België en Nederland.",
		icon: "ShoppingCart",
	},
	{
		key: "discounter",
		label: "Discounters",
		blurb: "Non-food deals en weekacties met de scherpste prijzen.",
		icon: "Tag",
	},
	{
		key: "doe-het-zelf",
		label: "Doe-het-zelf & Bouwmarkt",
		blurb: "Folders van bouwmarkten en doe-het-zelfzaken voor klussen, verf en gereedschap.",
		icon: "Hammer",
	},
	{
		key: "tuin",
		label: "Tuincentra",
		blurb: "Tuin-, plant- en buitenleven-aanbiedingen per seizoen.",
		icon: "Sprout",
	},
	{
		key: "dierenwinkel",
		label: "Dierenwinkels",
		blurb: "Voer en accessoires voor je huisdier in de aanbieding.",
		icon: "PawPrint",
	},
	{
		key: "drogist",
		label: "Drogist & Parfumerie",
		blurb: "Verzorging, gezondheid, make-up en parfum met wekelijkse kortingen.",
		icon: "Sparkles",
	},
	{
		key: "electronica",
		label: "Elektronica & Multimedia",
		blurb: "Deals op tv, computers, huishoudtoestellen en gadgets.",
		icon: "Smartphone",
	},
	{
		key: "mode",
		label: "Mode & Kleding",
		blurb: "Kledingfolders en seizoenskortingen voor het hele gezin.",
		icon: "Shirt",
	},
	{
		key: "warenhuis",
		label: "Warenhuizen & Variété",
		blurb: "Van alles wat: huishoud, decoratie, hobby en cadeaus.",
		icon: "Store",
	},
	{
		key: "wonen",
		label: "Wonen & Meubelen",
		blurb: "Meubels, interieur en woonaccessoires in de aanbieding.",
		icon: "Sofa",
	},
	{
		key: "speelgoed",
		label: "Speelgoed",
		blurb: "Speelgoedfolders, met pieken rond Sinterklaas en eindejaar.",
		icon: "ToyBrick",
	},
	{
		key: "sport",
		label: "Sport & Outdoor",
		blurb: "Sportkleding, fitness en outdoor-uitrusting met korting.",
		icon: "Dumbbell",
	},
];

export const catalog: CatalogShop[] = [
	// ── Supermarkten ──────────────────────────────────────────────────────────
	{ slug: "albert-heijn", name: "Albert Heijn", category: "supermarkt", countries: ["be", "nl"], website: "https://www.ah.be", color: "#00A0E2", source: "publitas", live: true },
	{ slug: "delhaize", name: "Delhaize", category: "supermarkt", countries: ["be"], website: "https://www.delhaize.be", color: "#E31837", source: "publitas", live: true },
	{ slug: "colruyt", name: "Colruyt", category: "supermarkt", countries: ["be"], website: "https://www.colruyt.be", color: "#E94E1B", source: "issuu", live: true },
	{ slug: "lidl", name: "Lidl", category: "supermarkt", countries: ["be", "nl"], website: "https://www.lidl.be", color: "#0050AA", source: "publitas", live: true },
	{ slug: "aldi", name: "ALDI", category: "supermarkt", countries: ["be", "nl"], website: "https://www.aldi.be", color: "#0B5AA2", source: "ipaper", live: true },
	{ slug: "jumbo", name: "Jumbo", category: "supermarkt", countries: ["be", "nl"], website: "https://www.jumbo.com", color: "#FDD800", source: "publitas", live: true },
	{ slug: "boni", name: "Boni", category: "supermarkt", countries: ["nl", "be"], website: "https://www.boni.nl", color: "#008D36", source: "publitas" },
	{ slug: "cora", name: "Cora", category: "supermarkt", countries: ["be"], website: "https://www.cora.be", color: "#E2001A", source: "publitas" },
	{ slug: "carrefour", name: "Carrefour", category: "supermarkt", countries: ["be"], website: "https://www.carrefour.be", color: "#004E9F", source: "own" },
	{ slug: "carrefour-market", name: "Carrefour Market", category: "supermarkt", countries: ["be"], website: "https://www.carrefour.be", color: "#E2231A", source: "own" },
	{ slug: "intermarche", name: "Intermarché", category: "supermarkt", countries: ["be"], website: "https://www.intermarche.be", color: "#E2001A", source: null },
	{ slug: "spar", name: "Spar", category: "supermarkt", countries: ["be", "nl"], website: "https://www.spar.be", color: "#009639", source: "publitas", live: true },
	{ slug: "okay", name: "OKay", category: "supermarkt", countries: ["be"], website: "https://www.okay.be", color: "#E30613", source: "issuu" },
	{ slug: "bio-planet", name: "Bio-Planet", category: "supermarkt", countries: ["be"], website: "https://www.bioplanet.be", color: "#76B82A", source: "issuu" },
	{ slug: "cru", name: "Cru", category: "supermarkt", countries: ["be"], website: "https://www.cru.be", color: "#1D1D1B", source: null },
	{ slug: "match", name: "Match", category: "supermarkt", countries: ["be"], website: "https://www.supermarchesmatch.be", color: "#E2001A", source: null },
	{ slug: "smatch", name: "Smatch", category: "supermarkt", countries: ["be"], website: "https://www.smatch.be", color: "#E30613", source: null },
	{ slug: "alvo", name: "Alvo", category: "supermarkt", countries: ["be"], website: "https://www.alvo.be", color: "#E2001A", source: null },
	{ slug: "plus", name: "PLUS", category: "supermarkt", countries: ["nl"], website: "https://www.plus.nl", color: "#008D36", source: "publitas", live: true },
	{ slug: "dirk", name: "Dirk", category: "supermarkt", countries: ["nl"], website: "https://www.dirk.nl", color: "#E2001A", source: "own" },
	{ slug: "coop", name: "Coop", category: "supermarkt", countries: ["nl"], website: "https://www.coop.nl", color: "#E2001A", source: "own" },
	{ slug: "vomar", name: "Vomar", category: "supermarkt", countries: ["nl"], website: "https://www.vomar.nl", color: "#E2001A", source: "own" },
	{ slug: "hoogvliet", name: "Hoogvliet", category: "supermarkt", countries: ["nl"], website: "https://www.hoogvliet.com", color: "#D2007A", source: "publitas", live: true },
	{ slug: "ekoplaza", name: "Ekoplaza", category: "supermarkt", countries: ["nl", "be"], website: "https://www.ekoplaza.nl", color: "#5B9E46", source: null },

	// ── Discounters ───────────────────────────────────────────────────────────
	{ slug: "action", name: "Action", category: "discounter", countries: ["be", "nl"], website: "https://www.action.com/nl-be", color: "#0046AD", source: "publitas", live: true },
	{ slug: "zeeman", name: "Zeeman", category: "discounter", countries: ["be", "nl"], website: "https://www.zeeman.com", color: "#E2001A", source: null },
	{ slug: "wibra", name: "Wibra", category: "discounter", countries: ["be", "nl"], website: "https://www.wibra.be", color: "#ED1C24", source: null },
	{ slug: "big-bazar", name: "Big Bazar", category: "discounter", countries: ["nl", "be"], website: "https://www.bigbazar.nl", color: "#E30613", source: null },
	{ slug: "trafic", name: "Trafic", category: "discounter", countries: ["be"], website: "https://www.trafic.be", color: "#E2001A", source: null },

	// ── Doe-het-zelf & Bouwmarkt ──────────────────────────────────────────────
	{ slug: "brico", name: "Brico", category: "doe-het-zelf", countries: ["be"], website: "https://www.brico.be", color: "#E2001A", source: "publitas", live: true },
	{ slug: "brico-planit", name: "Brico Plan-It", category: "doe-het-zelf", countries: ["be"], website: "https://www.brico.be", color: "#005CA9", source: "ipaper" },
	{ slug: "hubo", name: "Hubo", category: "doe-het-zelf", countries: ["be", "nl"], website: "https://www.hubo.be", color: "#E2001A", source: "publitas", live: true },
	{ slug: "gamma", name: "Gamma", category: "doe-het-zelf", countries: ["be", "nl"], website: "https://www.gamma.be", color: "#003DA5", source: "publitas", live: true },
	{ slug: "mr-bricolage", name: "Mr. Bricolage", category: "doe-het-zelf", countries: ["be"], website: "https://www.mr-bricolage.be", color: "#F39200", source: "publitas", live: true },
	{ slug: "karwei", name: "Karwei", category: "doe-het-zelf", countries: ["nl"], website: "https://www.karwei.nl", color: "#E2001A", source: "own" },
	{ slug: "praxis", name: "Praxis", category: "doe-het-zelf", countries: ["nl"], website: "https://www.praxis.nl", color: "#009A44", source: "own" },
	{ slug: "hornbach", name: "Hornbach", category: "doe-het-zelf", countries: ["be", "nl"], website: "https://www.hornbach.be", color: "#F7941E", source: "publitas", live: true },
	{ slug: "bauhaus", name: "Bauhaus", category: "doe-het-zelf", countries: ["be", "nl"], website: "https://www.bauhaus.be", color: "#E2001A", source: "publitas", live: true },

	// ── Tuincentra ────────────────────────────────────────────────────────────
	{ slug: "aveve", name: "Aveve", category: "tuin", countries: ["be"], website: "https://www.aveve.be", color: "#84BD00", source: "publitas" },
	{ slug: "horta", name: "Horta", category: "tuin", countries: ["be"], website: "https://www.horta.be", color: "#76B82A", source: null },
	{ slug: "oh-green", name: "Oh'Green", category: "tuin", countries: ["be"], website: "https://www.ohgreen.be", color: "#5B9E46", source: null },
	{ slug: "intratuin", name: "Intratuin", category: "tuin", countries: ["nl", "be"], website: "https://www.intratuin.nl", color: "#5B9E46", source: "publitas" },
	{ slug: "welkoop", name: "Welkoop", category: "tuin", countries: ["nl"], website: "https://www.welkoop.nl", color: "#E30613", source: "publitas", live: true },
	{ slug: "groenrijk", name: "GroenRijk", category: "tuin", countries: ["nl"], website: "https://www.groenrijk.nl", color: "#5B9E46", source: null },

	// ── Dierenwinkels ─────────────────────────────────────────────────────────
	{ slug: "tom-and-co", name: "Tom&Co", category: "dierenwinkel", countries: ["be"], website: "https://www.tomandco.be", color: "#E2001A", source: null },
	{ slug: "maxi-zoo", name: "Maxi Zoo", category: "dierenwinkel", countries: ["be", "nl"], website: "https://www.maxizoo.be", color: "#E2001A", source: "publitas" },
	{ slug: "pets-place", name: "Pets Place", category: "dierenwinkel", countries: ["nl"], website: "https://www.petsplace.nl", color: "#F39200", source: "own" },
	{ slug: "jumper", name: "Jumper", category: "dierenwinkel", countries: ["nl"], website: "https://www.jumper.nl", color: "#E2001A", source: null },

	// ── Drogist & Parfumerie ──────────────────────────────────────────────────
	{ slug: "kruidvat", name: "Kruidvat", category: "drogist", countries: ["be", "nl"], website: "https://www.kruidvat.be", color: "#E2001A", source: "own" },
	{ slug: "di", name: "Di", category: "drogist", countries: ["be"], website: "https://www.di.be", color: "#E6007E", source: null },
	{ slug: "medi-market", name: "Medi-Market", category: "drogist", countries: ["be"], website: "https://www.medi-market.be", color: "#00A19A", source: null },
	{ slug: "ici-paris-xl", name: "ICI PARIS XL", category: "drogist", countries: ["be", "nl"], website: "https://www.iciparisxl.be", color: "#1D1D1B", source: null },
	{ slug: "planet-parfum", name: "Planet Parfum", category: "drogist", countries: ["be"], website: "https://www.planetparfum.com", color: "#1D1D1B", source: null },
	{ slug: "etos", name: "Etos", category: "drogist", countries: ["nl"], website: "https://www.etos.nl", color: "#00857C", source: "own" },
	{ slug: "trekpleister", name: "Trekpleister", category: "drogist", countries: ["nl"], website: "https://www.trekpleister.nl", color: "#E2001A", source: "own" },
	{ slug: "douglas", name: "Douglas", category: "drogist", countries: ["be", "nl"], website: "https://www.douglas.be", color: "#1D1D1B", source: null },
	{ slug: "rituals", name: "Rituals", category: "drogist", countries: ["be", "nl"], website: "https://www.rituals.com", color: "#1D1D1B", source: null },
	{ slug: "holland-barrett", name: "Holland & Barrett", category: "drogist", countries: ["nl", "be"], website: "https://www.hollandandbarrett.nl", color: "#00643C", source: null },

	// ── Elektronica & Multimedia ──────────────────────────────────────────────
	{ slug: "mediamarkt", name: "MediaMarkt", category: "electronica", countries: ["be", "nl"], website: "https://www.mediamarkt.be", color: "#DF0000", source: "own" },
	{ slug: "krefel", name: "Krëfel", category: "electronica", countries: ["be"], website: "https://www.krefel.be", color: "#E2001A", source: "own" },
	{ slug: "vanden-borre", name: "Vanden Borre", category: "electronica", countries: ["be"], website: "https://www.vandenborre.be", color: "#004B93", source: "own" },
	{ slug: "coolblue", name: "Coolblue", category: "electronica", countries: ["be", "nl"], website: "https://www.coolblue.be", color: "#0090E3", source: "own" },
	{ slug: "bcc", name: "BCC", category: "electronica", countries: ["nl"], website: "https://www.bcc.nl", color: "#E2001A", source: "own" },
	{ slug: "expert", name: "Expert", category: "electronica", countries: ["nl", "be"], website: "https://www.expert.nl", color: "#003DA5", source: "own" },

	// ── Mode & Kleding ────────────────────────────────────────────────────────
	{ slug: "jbc", name: "JBC", category: "mode", countries: ["be"], website: "https://www.jbc.be", color: "#E6007E", source: null },
	{ slug: "zeb", name: "ZEB", category: "mode", countries: ["be"], website: "https://www.zeb.be", color: "#1D1D1B", source: null },
	{ slug: "c-and-a", name: "C&A", category: "mode", countries: ["be", "nl"], website: "https://www.c-and-a.com", color: "#002F87", source: null },
	{ slug: "e5", name: "e5", category: "mode", countries: ["be"], website: "https://www.e5.be", color: "#1D1D1B", source: "publitas", live: true },
	{ slug: "bel-and-bo", name: "Bel&Bo", category: "mode", countries: ["be"], website: "https://www.belenbo.be", color: "#E2001A", source: null },
	{ slug: "veritas", name: "Veritas", category: "mode", countries: ["be"], website: "https://www.veritas.be", color: "#1D1D1B", source: null },
	{ slug: "primark", name: "Primark", category: "mode", countries: ["be", "nl"], website: "https://www.primark.com", color: "#0089CF", source: null },

	// ── Warenhuizen & Variété ─────────────────────────────────────────────────
	{ slug: "hema", name: "HEMA", category: "warenhuis", countries: ["be", "nl"], website: "https://www.hema.be", color: "#008CC1", source: "own" },
	{ slug: "blokker", name: "Blokker", category: "warenhuis", countries: ["be", "nl"], website: "https://www.blokker.nl", color: "#E2001A", source: "publitas" },
	{ slug: "xenos", name: "Xenos", category: "warenhuis", countries: ["nl", "be"], website: "https://www.xenos.nl", color: "#C8102E", source: "publitas", live: true },
	{ slug: "casa", name: "Casa", category: "warenhuis", countries: ["be", "nl"], website: "https://www.casashops.com", color: "#E2001A", source: null },
	{ slug: "flying-tiger", name: "Flying Tiger", category: "warenhuis", countries: ["be", "nl"], website: "https://flyingtiger.com", color: "#00A859", source: null },
	{ slug: "normal", name: "Normal", category: "warenhuis", countries: ["be", "nl"], website: "https://www.normal.be", color: "#1D1D1B", source: null },
	{ slug: "gifi", name: "Gifi", category: "warenhuis", countries: ["be"], website: "https://www.gifi.be", color: "#E2001A", source: "publitas", live: true },

	// ── Wonen & Meubelen ──────────────────────────────────────────────────────
	{ slug: "ikea", name: "IKEA", category: "wonen", countries: ["be", "nl"], website: "https://www.ikea.com/be/nl", color: "#0058A3", source: "own" },
	{ slug: "jysk", name: "JYSK", category: "wonen", countries: ["be", "nl"], website: "https://www.jysk.be", color: "#003E7E", source: "publitas" },
	{ slug: "leen-bakker", name: "Leen Bakker", category: "wonen", countries: ["be", "nl"], website: "https://www.leenbakker.be", color: "#E2001A", source: "own" },
	{ slug: "kwantum", name: "Kwantum", category: "wonen", countries: ["nl", "be"], website: "https://www.kwantum.nl", color: "#E2001A", source: "own" },
	{ slug: "maisons-du-monde", name: "Maisons du Monde", category: "wonen", countries: ["be", "nl"], website: "https://www.maisonsdumonde.com", color: "#1D1D1B", source: null },

	// ── Speelgoed ─────────────────────────────────────────────────────────────
	{ slug: "dreamland", name: "Dreamland", category: "speelgoed", countries: ["be"], website: "https://www.dreamland.be", color: "#E2001A", source: "issuu" },
	{ slug: "maxi-toys", name: "Maxi Toys", category: "speelgoed", countries: ["be"], website: "https://www.maxitoys.be", color: "#E2001A", source: null },
	{ slug: "fun", name: "Fun", category: "speelgoed", countries: ["be"], website: "https://www.fun.be", color: "#FFD200", source: null },
	{ slug: "intertoys", name: "Intertoys", category: "speelgoed", countries: ["nl"], website: "https://www.intertoys.nl", color: "#E2001A", source: "own" },
	{ slug: "top1toys", name: "Top1Toys", category: "speelgoed", countries: ["nl"], website: "https://www.top1toys.nl", color: "#E2001A", source: null },

	// ── Sport & Outdoor ───────────────────────────────────────────────────────
	{ slug: "decathlon", name: "Decathlon", category: "sport", countries: ["be", "nl"], website: "https://www.decathlon.be", color: "#0082C3", source: null },
	{ slug: "as-adventure", name: "A.S.Adventure", category: "sport", countries: ["be"], website: "https://www.asadventure.com", color: "#1D1D1B", source: null },
	{ slug: "intersport", name: "Intersport", category: "sport", countries: ["be", "nl"], website: "https://www.intersport.be", color: "#003DA5", source: null },
	{ slug: "jd-sports", name: "JD Sports", category: "sport", countries: ["be", "nl"], website: "https://www.jdsports.be", color: "#1D1D1B", source: null },
];

export const liveCatalog = catalog.filter((s) => s.live);

export function shopsByCategory(category: ShopCategory): CatalogShop[] {
	return catalog.filter((s) => s.category === category);
}

export function catalogStats() {
	return {
		total: catalog.length,
		live: catalog.filter((s) => s.live).length,
		categories: categories.length,
	};
}
