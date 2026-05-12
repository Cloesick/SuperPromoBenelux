import { Retailer, Vertical } from "./types";

// ---------------------------------------------------------------------------
// Shared retailers (present in all verticals)
// ---------------------------------------------------------------------------

const SHARED: Vertical[] = [
	"general",
	"pet",
	"electro",
	"fashion",
	"home-garden",
	"beauty",
	"diy",
];

export const allRetailers: Retailer[] = [
	// ── Shared supermarket / discounter retailers ──────────────────────────
	{
		slug: "albert-heijn",
		name: "Albert Heijn",
		logo: "/retailers/albert-heijn.png",
		color: "#00A0E2",
		website: "https://www.ah.be",
		category: "supermarkt",
		verticals: SHARED,
		description:
			"Bekijk de nieuwste Albert Heijn Bonusfolder en ontdek de beste AH aanbiedingen van deze week.",
		seo: {
			folderDay: "maandag",
			folderDayDetail:
				"De nieuwe AH Bonusfolder verschijnt elke maandag en is geldig van maandag tot en met zondag.",
			storeCount: "meer dan 50 winkels in België",
			pricePositioning:
				"Albert Heijn positioneert zich in het middensegment met wekelijkse Bonus-aanbiedingen en 35% korting via de AH-app.",
			loyalty:
				"Bonuskaart (gratis) + AH Premium (betaald loyaliteitsprogramma met extra korting)",
			appName: "Albert Heijn app",
			openingHours:
				"Maandag t/m zaterdag 8:00–20:00, sommige vestigingen ook op zondag geopend.",
			uniqueSellingPoint:
				"Sterk in huismerken en Bonus-kortingen tot 50%, breed assortiment kant-en-klaar maaltijden.",
		},
	},
	{
		slug: "lidl",
		name: "Lidl",
		logo: "/retailers/lidl.png",
		color: "#0050AA",
		website: "https://www.lidl.be",
		category: "supermarkt",
		verticals: SHARED,
		description:
			"Ontdek de Lidl folder van deze week met de scherpste prijzen en weekendaanbiedingen.",
		seo: {
			folderDay: "maandag",
			folderDayDetail:
				"De Lidl folder verschijnt elke maandag. Daarnaast zijn er speciale weekendpromoties die op donderdag worden aangekondigd.",
			storeCount: "meer dan 310 winkels in België",
			pricePositioning:
				"Lidl is een discountsupermarkt met een focus op lage prijzen, sterke eigen merken en wekelijkse thema-acties (non-food).",
			loyalty:
				"Lidl Plus-app met digitale kortingsbonnen, kraskaarten en persoonlijke aanbiedingen.",
			appName: "Lidl Plus",
			openingHours:
				"Maandag t/m zaterdag 8:00–20:00. De meeste Lidl-winkels zijn gesloten op zondag.",
			uniqueSellingPoint:
				"Laagste vaste prijzen op basisproducten, wekelijkse non-food thema-aanbiedingen, en bakkerij in elke winkel.",
		},
	},
	{
		slug: "delhaize",
		name: "Delhaize",
		logo: "/retailers/delhaize.png",
		color: "#E31837",
		website: "https://www.delhaize.be",
		category: "supermarkt",
		verticals: SHARED,
		description:
			"Bekijk de Delhaize folder van deze week en profiteer van de beste supermarktpromoties.",
		seo: {
			folderDay: "donderdag",
			folderDayDetail:
				"De nieuwe Delhaize folder verschijnt elke donderdag en is geldig van donderdag tot en met woensdag van de volgende week.",
			storeCount:
				"meer dan 760 winkels in België (eigen winkels + AD Delhaize affiliates)",
			pricePositioning:
				"Delhaize positioneert zich als kwaliteitssupermarkt met een breed assortiment, sterke huismerken (365, Delhaize Bio) en regelmatige 1+1 gratis acties.",
			loyalty:
				"SuperPlus-kaart met persoonlijke kortingen en spaarpunten die inwisselbaar zijn voor korting.",
			appName: "Delhaize app",
			openingHours:
				"Maandag t/m zaterdag 8:00–20:00, veel AD Delhaize-winkels ook op zondag geopend (9:00–13:00).",
			uniqueSellingPoint:
				"Grootste assortiment van alle Belgische supermarkten, sterk in vers, bio en lokale producten.",
		},
	},
	{
		slug: "colruyt",
		name: "Colruyt",
		logo: "/retailers/colruyt.png",
		color: "#E94E1B",
		website: "https://www.colruyt.be",
		category: "supermarkt",
		verticals: SHARED,
		description:
			"Bekijk de Colruyt folder en ontdek de laagste prijzen van deze week in België.",
		seo: {
			folderDay: "woensdag",
			folderDayDetail:
				"De nieuwe Colruyt folder verschijnt elke woensdag en is geldig van woensdag tot en met dinsdag van de volgende week.",
			storeCount: "meer dan 240 Colruyt Laagste Prijzen-winkels in België",
			pricePositioning:
				"Colruyt garandeert de laagste prijs op elk product. Als een concurrent goedkoper is, past Colruyt de prijs onmiddellijk aan.",
			loyalty:
				"Xtra-kaart met digitale kortingsbonnen en spaarpunten (via de Xtra-app of CLP-app).",
			appName: "Colruyt app (CLP)",
			openingHours:
				"Maandag t/m zaterdag 8:30–20:00. Alle Colruyt-winkels zijn gesloten op zondag.",
			priceGuarantee:
				"Colruyt biedt de Laagste Prijzen Garantie: als je hetzelfde product elders goedkoper vindt, past Colruyt de prijs direct aan. Dit geldt voor het volledige assortiment.",
			uniqueSellingPoint:
				"Laagste prijzen garantie in België, geen reclame-franje: geen muziek, geen fancy inrichting, alles gericht op de laagste prijs voor de klant.",
		},
	},
	{
		slug: "aldi",
		name: "ALDI",
		logo: "/retailers/aldi.svg",
		color: "#0B5AA2",
		website: "https://www.aldi.be",
		category: "supermarkt",
		verticals: SHARED,
		description:
			"Bekijk de ALDI folder van deze week en ontdek de nieuwste promoties en straffe specials.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail:
				"ALDI publiceert elke week een nieuwe folder met verrassende promo's en straffe specials.",
			storeCount: "meer dan 445 winkels in België",
			pricePositioning:
				"ALDI is een discountsupermarkt met een focus op hoge kwaliteit aan de laagst mogelijke prijs, met wekelijks wisselende acties naast het vaste assortiment.",
			loyalty:
				"ALDI-punten via de ALDI-app (spaarprogramma met voordelen en acties).",
			appName: "ALDI app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 8:00–20:00 (verschilt per vestiging). ALDI is meestal gesloten op zondag.",
			uniqueSellingPoint:
				"Sterk in scherpe prijzen, compacte winkels en wekelijkse acties (Specials) naast dagelijkse basisproducten.",
		},
	},
	{
		slug: "action",
		name: "Action",
		logo: "/retailers/action.svg",
		color: "#0046AD",
		website: "https://www.action.com/nl-be",
		category: "discounter",
		verticals: SHARED,
		description:
			"Bekijk de Action folder en weekactie aanbiedingen in België met kleine prijzen en grote glimlach.",
		seo: {
			folderDay: "woensdag",
			folderDayDetail:
				"De nieuwe Action-folder verschijnt elke woensdag met weekdeals, nieuwe producten en basics voor elke dag.",
			storeCount: "meer dan 3000 winkels in Europa (ook in België)",
			pricePositioning:
				"Action is een non-food discounter met een breed en snel wisselend assortiment tegen zeer lage prijzen, met veel producten onder 1 euro.",
			loyalty:
				"Geen klassieke klantenkaart; je kunt wel een Action-account gebruiken voor favorieten en productinformatie.",
			appName: "Action app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 9:00–19:00, vaak ook open op zondag (verschilt per winkel).",
			uniqueSellingPoint:
				"Elke week nieuwe non-food deals (huishouden, decoratie, hobby, multimedia) met extreem scherpe prijzen.",
		},
	},

	// ── Pet-specific ──────────────────────────────────────────────────────
	{
		slug: "maxi-zoo",
		name: "Maxi Zoo",
		logo: "/retailers/maxi-zoo.svg",
		color: "#F97316",
		website: "https://www.maxizoo.be",
		category: "dierenwinkel",
		verticals: ["pet"],
		description:
			"Bekijk Maxi Zoo promoties op voeding, snacks en accessoires voor huisdieren.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail:
				"Maxi Zoo heeft regelmatig acties en promoties. Bekijk de actuele aanbiedingen.",
			storeCount: "winkels in België",
			pricePositioning: "Dierenwinkel met regelmatige kortingen en acties.",
			loyalty: "Nieuwsbrief / account",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint:
				"Breed assortiment voeding en accessoires voor huisdieren.",
		},
	},
	{
		slug: "tom-co",
		name: "Tom&Co",
		logo: "/retailers/tom-co.svg",
		color: "#16A34A",
		website: "https://www.tomandco.com",
		category: "dierenwinkel",
		verticals: ["pet"],
		description:
			"Ontdek Tom&Co acties op dierenvoeding, speelgoed en verzorging.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail:
				"Tom&Co heeft regelmatig promoties. Bekijk de actuele deals.",
			storeCount: "winkels in België",
			pricePositioning: "Dierenwinkel met regelmatige promoties.",
			loyalty: "Account / nieuwsbrief",
			openingHours: "Openingstijden verschillen per winkel.",
			uniqueSellingPoint: "Veel acties op voeding en accessoires.",
		},
	},
	{
		slug: "zooplus",
		name: "Zooplus",
		logo: "/retailers/zooplus.svg",
		color: "#2563EB",
		website: "https://www.zooplus.be",
		category: "dierenwinkel",
		verticals: ["pet"],
		description:
			"Bekijk Zooplus promoties op online dierenvoeding en accessoires.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail:
				"Zooplus heeft doorlopend promoties en acties. Bekijk de nieuwste deals.",
			storeCount: "online",
			pricePositioning: "Online petshop met regelmatige kortingen.",
			loyalty: "Account",
			openingHours: "Online",
			uniqueSellingPoint:
				"Groot assortiment en vaak scherpe acties op voeding.",
		},
	},
	{
		slug: "aveve",
		name: "AVEVE",
		logo: "/retailers/aveve.svg",
		color: "#16A34A",
		website: "https://www.aveve.be",
		category: "dierenwinkel",
		verticals: ["pet"],
		description: "Ontdek AVEVE promoties op tuin, dieren en buitenleven.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail:
				"AVEVE heeft regelmatig acties en promoties. Bekijk de actuele aanbiedingen.",
			storeCount: "winkels in België",
			pricePositioning: "Tuin- en dierproducten met promoties.",
			loyalty: "Account / nieuwsbrief",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint: "Tuin, dieren en hobby met acties.",
		},
	},
	{
		slug: "medpets",
		name: "Medpets",
		logo: "/retailers/medpets.svg",
		color: "#111827",
		website: "https://www.medpets.be",
		category: "dierenwinkel",
		verticals: ["pet"],
		description:
			"Bekijk Medpets promoties op diergeneesmiddelen, supplementen en verzorging.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail:
				"Medpets heeft regelmatig promoties en bundeldeals. Bekijk de nieuwste aanbiedingen.",
			storeCount: "online",
			pricePositioning: "Online pet health & care met promoties.",
			loyalty: "Account",
			openingHours: "Online",
			uniqueSellingPoint: "Sterk in pet health en verzorging.",
		},
	},

	// ── Electro-specific ──────────────────────────────────────────────────
	{
		slug: "mediamarkt",
		name: "MediaMarkt",
		logo: "/retailers/mediamarkt.svg",
		color: "#E3000F",
		website: "https://www.mediamarkt.be",
		category: "electronica",
		verticals: ["electro"],
		description:
			"Bekijk de nieuwste MediaMarkt folder en promoties op tv, laptops, smartphones en meer.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail:
				"MediaMarkt publiceert regelmatig nieuwe acties en promoties.",
			storeCount: "winkels in België en Nederland",
			pricePositioning:
				"Breed assortiment elektronica met scherpe acties en tijdelijke promoties.",
			loyalty: "Nieuwsbrief en online account",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint:
				"Grote keuze in elektronica, vaak sterke promoties op A-merken.",
		},
	},
	{
		slug: "coolblue",
		name: "Coolblue",
		logo: "/retailers/coolblue.svg",
		color: "#0090E3",
		website: "https://www.coolblue.be",
		category: "electronica",
		verticals: ["electro"],
		description:
			"Bekijk Coolblue acties en promoties op elektronica, huishoudtoestellen en gaming.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail:
				"Coolblue heeft doorlopend promoties en tijdelijke deals.",
			storeCount: "winkels en online in België en Nederland",
			pricePositioning:
				"Sterk in service en snelle levering met regelmatige deals.",
			loyalty: "Account met orderhistoriek",
			openingHours: "Openingstijden verschillen per winkel.",
			uniqueSellingPoint:
				"Service, snelle levering en duidelijke productinformatie.",
		},
	},
	{
		slug: "vanden-borre",
		name: "Vanden Borre",
		logo: "/retailers/vanden-borre.svg",
		color: "#E3000F",
		website: "https://www.vandenborre.be",
		category: "electronica",
		verticals: ["electro"],
		description:
			"Bekijk Vanden Borre promoties op wasmachines, vaatwassers, koelkasten en meer.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail: "Vanden Borre heeft regelmatig promoties en acties.",
			storeCount: "winkels in België",
			pricePositioning: "Huishoudtoestellen en elektro met promoties.",
			loyalty: "Nieuwsbrief en online account",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint: "Sterk in huishoudtoestellen en service in België.",
		},
	},
	{
		slug: "krefel",
		name: "Krëfel",
		logo: "/retailers/krefel.svg",
		color: "#D70000",
		website: "https://www.krefel.be",
		category: "electronica",
		verticals: ["electro"],
		description:
			"Ontdek Krëfel promoties op huishoudtoestellen, tv en elektro.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail: "Krëfel brengt regelmatig acties en promoties.",
			storeCount: "winkels in België",
			pricePositioning: "Promoties op elektro en huishoudtoestellen.",
			loyalty: "Nieuwsbrief en account",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint: "Breed aanbod met tijdelijke promoties.",
		},
	},
	{
		slug: "bol",
		name: "bol",
		logo: "/retailers/bol.svg",
		color: "#2563EB",
		website: "https://www.bol.com",
		category: "electronica",
		verticals: ["electro"],
		description:
			"Bekijk bol deals op huishoudtoestellen, stofzuigers en keukenapparatuur.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail: "bol heeft doorlopend promoties en tijdelijke deals.",
			storeCount: "online",
			pricePositioning: "Breed aanbod met wisselende promoties.",
			loyalty: "Account",
			openingHours: "Online",
			uniqueSellingPoint: "Groot assortiment en snelle levering.",
		},
	},

	// ── Fashion-specific ──────────────────────────────────────────────────
	{
		slug: "hm",
		name: "H&M",
		logo: "/retailers/hm.svg",
		color: "#E11D48",
		website: "https://www2.hm.com/nl_be",
		category: "mode",
		verticals: ["fashion"],
		description:
			"Bekijk H&M promoties en acties op dames-, heren- en kinderkleding.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail:
				"H&M heeft doorlopend aanbiedingen en tijdelijke acties.",
			storeCount: "winkels in België en Nederland",
			pricePositioning: "Mode met regelmatige acties en seizoenskortingen.",
			loyalty: "H&M Member",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint: "Grote collectie en regelmatige kortingen.",
		},
	},
	{
		slug: "zalando",
		name: "Zalando",
		logo: "/retailers/zalando.svg",
		color: "#111827",
		website: "https://www.zalando.be",
		category: "mode",
		verticals: ["fashion"],
		description: "Bekijk Zalando promoties op mode, schoenen en accessoires.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail:
				"Zalando heeft doorlopend acties en tijdelijke promoties.",
			storeCount: "online",
			pricePositioning: "Grote keuze merken met regelmatige promoties.",
			loyalty: "Account",
			openingHours: "Online",
			uniqueSellingPoint: "Groot aanbod merken met snelle levering en returns.",
		},
	},

	// ── Home & Garden-specific ────────────────────────────────────────────
	{
		slug: "ikea",
		name: "IKEA",
		logo: "/retailers/ikea.svg",
		color: "#1D4ED8",
		website: "https://www.ikea.com/be/nl",
		category: "meubels",
		verticals: ["home-garden"],
		description:
			"Bekijk IKEA promoties op meubels, interieur en woonaccessoires.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail: "IKEA heeft doorlopend acties en tijdelijke deals.",
			storeCount: "winkels in België en Nederland",
			pricePositioning: "Wonen en meubels met regelmatige promoties.",
			loyalty: "IKEA Family",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint:
				"Grote keuze meubels en interieur met IKEA Family deals.",
		},
	},
	{
		slug: "gamma",
		name: "Gamma",
		logo: "/retailers/gamma.svg",
		color: "#FFC107",
		website: "https://www.gamma.be",
		category: "bouwmarkt",
		verticals: ["home-garden"],
		description:
			"Bekijk Gamma acties op bouwmaterialen en doe-het-zelf producten.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail: "Gamma heeft regelmatig acties en promoties.",
			storeCount: "winkels in België",
			pricePositioning:
				"Bouwmaterialen en doe-het-zelf producten met promoties.",
			loyalty: "Nieuwsbrief / account",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint:
				"Grote keuze bouwmaterialen en doe-het-zelf producten.",
		},
	},

	// ── Beauty-specific ───────────────────────────────────────────────────
	{
		slug: "kruidvat",
		name: "Kruidvat",
		logo: "/retailers/kruidvat.svg",
		color: "#E3000F",
		website: "https://www.kruidvat.be",
		category: "drogist",
		verticals: ["beauty"],
		description:
			"Bekijk de nieuwste Kruidvat folder en promoties op verzorging, beauty en huishoudproducten.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail:
				"Kruidvat publiceert regelmatig nieuwe acties en promoties.",
			storeCount: "winkels in België en Nederland",
			pricePositioning:
				"Sterk in lage prijzen met wekelijkse acties op A-merken en eigen merk.",
			loyalty: "Kruidvat Club / account",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint:
				"Veel 1+1 acties en scherpe deals op beauty en verzorging.",
		},
	},
	{
		slug: "ici-paris-xl",
		name: "ICI PARIS XL",
		logo: "/retailers/ici-paris-xl.svg",
		color: "#111827",
		website: "https://www.iciparisxl.be",
		category: "parfum",
		verticals: ["beauty"],
		description:
			"Ontdek ICI PARIS XL promoties op parfum, make-up en skincare.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail:
				"ICI PARIS XL heeft doorlopend promoties en tijdelijke acties.",
			storeCount: "winkels in België",
			pricePositioning: "Regelmatige kortingen op parfum en beauty merken.",
			loyalty: "Loyaltyprogramma / account",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint: "Sterk in parfum en luxe beauty met kortingen.",
		},
	},
	{
		slug: "douglas",
		name: "Douglas",
		logo: "/retailers/douglas.svg",
		color: "#111827",
		website: "https://www.douglas.be",
		category: "beauty",
		verticals: ["beauty"],
		description: "Bekijk Douglas promoties op parfum, make-up en verzorging.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail: "Douglas heeft doorlopend acties en tijdelijke deals.",
			storeCount: "winkels en online in België en Nederland",
			pricePositioning: "Premium beauty met regelmatige promoties.",
			loyalty: "Beauty Card / account",
			openingHours: "Openingstijden verschillen per winkel.",
			uniqueSellingPoint: "Veel premium merken met regelmatige kortingen.",
		},
	},
	{
		slug: "di",
		name: "Di",
		logo: "/retailers/di.svg",
		color: "#EC4899",
		website: "https://www.di.be",
		category: "drogist",
		verticals: ["beauty"],
		description: "Ontdek Di promoties op make-up, parfum en verzorging.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail: "Di publiceert regelmatig promoties en acties.",
			storeCount: "winkels in België",
			pricePositioning: "Beauty en verzorging met acties op bekende merken.",
			loyalty: "Account / nieuwsbrief",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint: "Beauty en parfum deals in België.",
		},
	},
	{
		slug: "etos",
		name: "Etos",
		logo: "/retailers/etos.svg",
		color: "#2563EB",
		website: "https://www.etos.nl",
		category: "drogist",
		verticals: ["beauty"],
		description:
			"Bekijk Etos promoties op drogisterijproducten en beauty in Nederland.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail: "Etos heeft regelmatig nieuwe acties en promoties.",
			storeCount: "winkels in Nederland",
			pricePositioning: "Drogisterij met acties op A-merken en eigen merk.",
			loyalty: "Etos Extra / account",
			openingHours: "Openingstijden verschillen per winkel.",
			uniqueSellingPoint: "Sterk in drogisterijdeals in Nederland.",
		},
	},
	{
		slug: "boots",
		name: "Boots",
		logo: "/retailers/boots.svg",
		color: "#FFC107",
		website: "https://www.boots.com",
		category: "beauty",
		verticals: ["beauty"],
		description: "Bekijk Boots promoties op beauty en verzorging.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail: "Boots heeft doorlopend acties en tijdelijke deals.",
			storeCount: "winkels in België en Nederland",
			pricePositioning: "Premium beauty met regelmatige promoties.",
			loyalty: "Boots Advantage Card / account",
			openingHours: "Openingstijden verschillen per winkel.",
			uniqueSellingPoint: "Veel premium merken met regelmatige kortingen.",
		},
	},
	{
		slug: "muller",
		name: "Müller",
		logo: "/retailers/muller.svg",
		color: "#FF69B4",
		website: "https://www.muller.be",
		category: "beauty",
		verticals: ["beauty"],
		description: "Bekijk Müller promoties op beauty en verzorging.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail: "Müller heeft doorlopend acties en tijdelijke deals.",
			storeCount: "winkels in België en Nederland",
			pricePositioning: "Premium beauty met regelmatige promoties.",
			loyalty: "Müller Card / account",
			openingHours: "Openingstijden verschillen per winkel.",
			uniqueSellingPoint: "Veel premium merken met regelmatige kortingen.",
		},
	},
	{
		slug: "rossmann",
		name: "Rossmann",
		logo: "/retailers/rossmann.svg",
		color: "#8BC34A",
		website: "https://www.rossmann.nl",
		category: "drogist",
		verticals: ["beauty"],
		description:
			"Bekijk Rossmann promoties op drogisterijproducten en beauty in Nederland.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail: "Rossmann heeft regelmatig nieuwe acties en promoties.",
			storeCount: "winkels in Nederland",
			pricePositioning: "Drogisterij met acties op A-merken en eigen merk.",
			loyalty: "Rossmann Card / account",
			openingHours: "Openingstijden verschillen per winkel.",
			uniqueSellingPoint: "Sterk in drogisterijdeals in Nederland.",
		},
	},
	{
		slug: "treac",
		name: "Trekpleister",
		logo: "/retailers/treac.svg",
		color: "#4CAF50",
		website: "https://www.trekpleister.nl",
		category: "drogist",
		verticals: ["beauty"],
		description:
			"Bekijk Trekpleister promoties op drogisterijproducten en beauty in Nederland.",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail:
				"Trekpleister heeft regelmatig nieuwe acties en promoties.",
			storeCount: "winkels in Nederland",
			pricePositioning: "Drogisterij met acties op A-merken en eigen merk.",
			loyalty: "Trekpleister Card / account",
			openingHours: "Openingstijden verschillen per winkel.",
			uniqueSellingPoint: "Sterk in drogisterijdeals in Nederland.",
		},
	},
	{
		slug: "rituals",
		name: "Rituals",
		logo: "/retailers/rituals.svg",
		color: "#111827",
		website: "https://www.rituals.com",
		category: "beauty",
		verticals: ["beauty"],
		description: "Bekijk Rituals promoties op body, home en cadeau-sets.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail:
				"Rituals heeft doorlopend acties en tijdelijke promoties.",
			storeCount: "winkels en online in België en Nederland",
			pricePositioning: "Premium verzorging met acties op sets en limiteds.",
			loyalty: "Account / nieuwsbrief",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint: "Sterk in cadeau-sets en home geuren.",
		},
	},
	{
		slug: "yves-rocher",
		name: "Yves Rocher",
		logo: "/retailers/yves-rocher.svg",
		color: "#16A34A",
		website: "https://www.yves-rocher.be",
		category: "beauty",
		verticals: ["beauty"],
		description: "Ontdek Yves Rocher acties op verzorging, parfum en make-up.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail:
				"Yves Rocher heeft doorlopend promoties en tijdelijke deals.",
			storeCount: "winkels en online in België",
			pricePositioning: "Regelmatige kortingen op verzorging en beauty.",
			loyalty: "Loyaltyprogramma / account",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint: "Veel bundelacties en seizoenspromoties.",
		},
	},
	{
		slug: "the-body-shop",
		name: "The Body Shop",
		logo: "/retailers/the-body-shop.svg",
		color: "#047857",
		website: "https://www.thebodyshop.com",
		category: "beauty",
		verticals: ["beauty"],
		description:
			"Bekijk The Body Shop promoties op bodycare, skincare en gifts.",
		seo: {
			folderDay: "doorlopend",
			folderDayDetail:
				"The Body Shop heeft doorlopend acties en tijdelijke promoties.",
			storeCount: "winkels en online",
			pricePositioning: "Regelmatige promoties op verzorging en gifts.",
			loyalty: "Account / nieuwsbrief",
			openingHours: "Openingstijden verschillen per vestiging.",
			uniqueSellingPoint: "Sterk assortiment verzorging met acties op sets.",
		},
	},
];

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function getRetailersForVertical(vertical: Vertical): Retailer[] {
	return allRetailers.filter((r) => r.verticals.includes(vertical));
}

export const retailers: Retailer[] = allRetailers;

export function getRetailerBySlug(slug: string): Retailer | undefined {
	return allRetailers.find((r) => r.slug === slug);
}

export function getRetailerBySlugForVertical(
	slug: string,
	vertical: Vertical,
): Retailer | undefined {
	return allRetailers.find(
		(r) => r.slug === slug && r.verticals.includes(vertical),
	);
}

export function getRetailersByCategory(
	category: Retailer["category"],
): Retailer[] {
	return allRetailers.filter((r) => r.category === category);
}

export function getAllRetailerSlugs(): string[] {
	return [...new Set(allRetailers.map((r) => r.slug))];
}

export function getRetailerSlugsForVertical(vertical: Vertical): string[] {
	return getRetailersForVertical(vertical).map((r) => r.slug);
}
