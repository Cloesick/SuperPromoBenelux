import { Retailer } from "./types";

export const retailersBe: Retailer[] = [
	{
		slug: "albert-heijn",
		name: "Albert Heijn",
		logo: "/retailers/albert-heijn.webp",
		color: "#00A0E2",
		website: "https://www.ah.be",
		description:
			"Bekijk de nieuwste Albert Heijn Bonusfolder en ontdek de beste AH aanbiedingen van deze week.",
		category: "supermarkt",
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
		logo: "/retailers/lidl.webp",
		color: "#0050AA",
		website: "https://www.lidl.be",
		description:
			"Ontdek de Lidl folder van deze week met de scherpste prijzen en weekendaanbiedingen.",
		category: "supermarkt",
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
		logo: "/retailers/delhaize.webp",
		color: "#E31837",
		website: "https://www.delhaize.be",
		description:
			"Bekijk de Delhaize folder van deze week en profiteer van de beste supermarktpromoties.",
		category: "supermarkt",
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
		logo: "/retailers/colruyt.webp",
		color: "#E94E1B",
		website: "https://www.colruyt.be",
		description:
			"Bekijk de Colruyt folder en ontdek de laagste prijzen van deze week in België.",
		category: "supermarkt",
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
		logo: "/retailers/aldi.webp",
		color: "#0B5AA2",
		website: "https://www.aldi.be",
		description:
			"Bekijk de ALDI folder van deze week en ontdek de nieuwste promoties en straffe specials.",
		category: "supermarkt",
		seo: {
			folderDay: "wekelijks",
			folderDayDetail:
				"ALDI publiceert elke week een nieuwe folder met verrassende promo’s en straffe specials. Bekijk ook de folder van volgende week om je boodschappen vooruit te plannen.",
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
		logo: "/retailers/action.webp",
		color: "#0046AD",
		website: "https://www.action.com/nl-be",
		description:
			"Bekijk de Action folder en weekactie aanbiedingen in België met kleine prijzen en grote glimlach.",
		category: "discounter",
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
	{
		slug: "jumbo",
		name: "Jumbo",
		logo: "/retailers/jumbo.svg",
		color: "#FDD800",
		website: "https://www.jumbo.com",
		description:
			"Bekijk de Jumbo actiefolder van deze week met scherpe acties en de 7 zekerheden van Jumbo.",
		category: "supermarkt",
		seo: {
			folderDay: "woensdag",
			folderDayDetail:
				"De nieuwe Jumbo actiefolder verschijnt wekelijks (loopt van woensdag tot en met dinsdag) met weekdeals en wisselende acties.",
			storeCount: "29 winkels in België en honderden in Nederland",
			pricePositioning:
				"Jumbo combineert lage prijzen met service via de '7 zekerheden', waaronder de laagste prijs-garantie en vlotte kassa's.",
			loyalty:
				"Jumbo Extra's: digitaal spaarprogramma met persoonlijke acties via de Jumbo-app.",
			appName: "Jumbo app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 8:00–20:00, veel winkels ook op zondag geopend.",
			priceGuarantee:
				"Via de '7 zekerheden' garandeert Jumbo de laagste prijs: vind je een product elders goedkoper, dan krijg je het verschil terug.",
			uniqueSellingPoint:
				"Nederlandse familieketen met sterke service (7 zekerheden), breed assortiment en een groeiend winkelnet in België.",
		},
	},
	{
		slug: "plus",
		name: "PLUS",
		logo: "/retailers/plus.svg",
		color: "#008D36",
		website: "https://www.plus.nl",
		description:
			"Bekijk de PLUS folder van deze week met de actuele aanbiedingen en weekacties van PLUS supermarkt.",
		category: "supermarkt",
		seo: {
			folderDay: "zondag",
			folderDayDetail:
				"De nieuwe PLUS folder verschijnt wekelijks en loopt doorgaans van zondag tot en met zaterdag.",
			storeCount: "ruim 270 winkels in Nederland",
			pricePositioning:
				"PLUS is een servicesupermarkt in het middensegment met wekelijkse acties en een sterk vers-assortiment.",
			loyalty:
				"PLUS-app met digitale spaaracties, persoonlijke aanbiedingen en de Koopzegels-spaarregeling.",
			appName: "PLUS app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 8:00–20:00, veel winkels ook op zondag geopend.",
			uniqueSellingPoint:
				"Coöperatieve servicesupermarkt met sterk vers- en streekassortiment en wekelijkse weekacties.",
		},
	},
	{
		slug: "hubo",
		name: "Hubo",
		logo: "/retailers/hubo.svg",
		color: "#E2001A",
		website: "https://www.hubo.be",
		description:
			"Bekijk de Hubo folder van deze week met doe-het-zelf aanbiedingen, gereedschap en tuinacties.",
		category: "doe-het-zelf",
		seo: {
			folderDay: "woensdag",
			folderDayDetail:
				"De Hubo folder verschijnt wekelijks met wisselende doe-het-zelf-, tuin- en seizoensacties.",
			storeCount: "meer dan 140 winkels in België",
			pricePositioning:
				"Hubo is een toegankelijke doe-het-zelfketen met scherpe weekacties en een breed klusassortiment.",
			loyalty:
				"Hubo Klantenkaart met spaarvoordeel en persoonlijke aanbiedingen.",
			appName: "Hubo app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 9:00–18:00, openingsuren verschillen per zelfstandige winkel.",
			uniqueSellingPoint:
				"Lokale doe-het-zelfwinkels met persoonlijk advies, breed assortiment en wekelijkse klusacties.",
		},
	},
	{
		slug: "gamma",
		name: "Gamma",
		logo: "/retailers/gamma.svg",
		color: "#003DA5",
		website: "https://www.gamma.be",
		description:
			"Bekijk de Gamma folder van deze week met bouwmarkt-aanbiedingen, gereedschap, verf en tuin.",
		category: "doe-het-zelf",
		seo: {
			folderDay: "woensdag",
			folderDayDetail:
				"De nieuwe Gamma folder verschijnt wekelijks met acties op gereedschap, verf, hout, tuin en sanitair.",
			storeCount: "meer dan 80 winkels in België",
			pricePositioning:
				"Gamma is een grote bouwmarktketen met een compleet assortiment en wekelijkse promoties.",
			loyalty:
				"GAMMA plus-kaart met spaarpunten, persoonlijke acties en kortingsbonnen.",
			appName: "GAMMA app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 8:00–19:00, veel winkels ook op zondag geopend.",
			uniqueSellingPoint:
				"Compleet bouwmarktassortiment onder één dak met sterke weekacties en doe-het-zelf advies.",
		},
	},
	{
		slug: "mr-bricolage",
		name: "Mr. Bricolage",
		logo: "/retailers/mr-bricolage.svg",
		color: "#F39200",
		website: "https://www.mr-bricolage.be",
		description:
			"Bekijk de Mr. Bricolage folder met doe-het-zelf aanbiedingen, gereedschap, tuin en decoratie.",
		category: "doe-het-zelf",
		seo: {
			folderDay: "maandelijks",
			folderDayDetail:
				"De Mr. Bricolage folder verschijnt periodiek (per actiefolder) met klus-, tuin- en seizoensacties.",
			storeCount: "meer dan 40 winkels in België",
			pricePositioning:
				"Mr. Bricolage is een doe-het-zelfketen met een breed assortiment en periodieke actiefolders.",
			loyalty:
				"Mr. Bricolage klantenkaart met voordelen en persoonlijke acties.",
			appName: "Mr. Bricolage app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 9:00–18:30, openingsuren verschillen per winkel.",
			uniqueSellingPoint:
				"Doe-het-zelfwinkels met persoonlijk advies, breed klus- en tuinassortiment en periodieke acties.",
		},
	},
	{
		slug: "spar",
		name: "Spar",
		logo: "/retailers/spar.svg",
		color: "#009639",
		website: "https://www.spar.be",
		description:
			"Bekijk de Spar folder van deze week met de actuele buurtsupermarkt-aanbiedingen van Spar.",
		category: "supermarkt",
		seo: {
			folderDay: "donderdag",
			folderDayDetail:
				"De Spar folder verschijnt wekelijks met acties voor de buurtsupermarkt.",
			storeCount: "honderden buurtwinkels in België en Nederland",
			pricePositioning:
				"Spar is een buurtsupermarktketen met gemak, vers en wekelijkse acties dicht bij huis.",
			loyalty: "Spar-app en spaaracties met persoonlijke aanbiedingen.",
			appName: "Spar app",
			openingHours:
				"Dagelijks geopend met ruime openingsuren; verschilt per zelfstandige winkel.",
			uniqueSellingPoint:
				"Buurtsupermarkt met nadruk op gemak, vers assortiment en lokale nabijheid.",
		},
	},
	{
		slug: "hoogvliet",
		name: "Hoogvliet",
		logo: "/retailers/hoogvliet.svg",
		color: "#D2007A",
		website: "https://www.hoogvliet.com",
		description:
			"Bekijk de Hoogvliet folder van deze week met de scherpe weekaanbiedingen van Hoogvliet supermarkt.",
		category: "supermarkt",
		seo: {
			folderDay: "zondag",
			folderDayDetail:
				"De nieuwe Hoogvliet folder verschijnt wekelijks met weekacties en versdeals.",
			storeCount: "ruim 70 winkels in Nederland",
			pricePositioning:
				"Hoogvliet is een Nederlandse servicesupermarkt met scherpe weekacties en een sterk versaanbod.",
			loyalty: "Hoogvliet-app met digitale acties en persoonlijke aanbiedingen.",
			appName: "Hoogvliet app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 8:00–20:00, veel winkels ook op zondag geopend.",
			uniqueSellingPoint:
				"Regionale servicesupermarkt met sterke versafdelingen en wekelijkse weekacties.",
		},
	},
	{
		slug: "xenos",
		name: "Xenos",
		logo: "/retailers/xenos.svg",
		color: "#C8102E",
		website: "https://www.xenos.nl",
		description:
			"Bekijk de Xenos folder met aanbiedingen in woonaccessoires, decoratie, keuken en lekkernijen.",
		category: "warenhuis",
		seo: {
			folderDay: "maandag",
			folderDayDetail:
				"De Xenos folder verschijnt periodiek met acties op wonen, decoratie, keuken en seizoensartikelen.",
			storeCount: "meer dan 200 winkels in Nederland en België",
			pricePositioning:
				"Xenos is een woon- en lifestyle-warenhuis met betaalbare decoratie, keukenwaren en wereldse lekkernijen.",
			loyalty: "Xenos-acties en nieuwsbrief met aanbiedingen.",
			appName: "Xenos app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 9:00–18:00, koopzondagen per locatie.",
			uniqueSellingPoint:
				"Betaalbaar woon- en lifestyle-assortiment met sterk wisselende seizoenscollecties.",
		},
	},
	{
		slug: "hornbach",
		name: "Hornbach",
		logo: "/retailers/hornbach.svg",
		color: "#F7941E",
		website: "https://www.hornbach.be",
		description:
			"Bekijk de Hornbach folder met aanbiedingen in bouwmarkt, tuin, gereedschap en projectmateriaal.",
		category: "doe-het-zelf",
		seo: {
			folderDay: "maandag",
			folderDayDetail:
				"De Hornbach folder verschijnt periodiek met acties op bouwmaterialen, tuin en gereedschap.",
			storeCount: "megastores in België en Nederland",
			pricePositioning:
				"Hornbach is een projectbouwmarkt met een zeer breed assortiment en permanent lage prijzen.",
			loyalty: "Hornbach ProfiCard en app met projectvoordeel.",
			appName: "Hornbach app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 7:00–20:00; ruime openingsuren in megastores.",
			uniqueSellingPoint:
				"Projectbouwmarkt met enorm assortiment, drive-in en permanent lage prijsgarantie.",
		},
	},
	{
		slug: "welkoop",
		name: "Welkoop",
		logo: "/retailers/welkoop.svg",
		color: "#E30613",
		website: "https://www.welkoop.nl",
		description:
			"Bekijk de Welkoop folder met aanbiedingen voor tuin, dier en buitenleven.",
		category: "doe-het-zelf",
		seo: {
			folderDay: "maandag",
			folderDayDetail:
				"De nieuwe Welkoop folder verschijnt wekelijks met acties voor tuin, dier en buitenleven.",
			storeCount: "ruim 150 winkels in Nederland",
			pricePositioning:
				"Welkoop is dé winkel voor tuin, dier en boerenleven met wekelijkse acties.",
			loyalty: "Welkoop-spaarprogramma en app met persoonlijke voordelen.",
			appName: "Welkoop app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 9:00–18:00, koopzondagen per locatie.",
			uniqueSellingPoint:
				"Specialist in tuin, dier en buitenleven met breed assortiment en deskundig advies.",
		},
	},
	{
		slug: "e5",
		name: "e5",
		logo: "/retailers/e5.svg",
		color: "#1D1D1B",
		website: "https://www.e5.be",
		description:
			"Bekijk de e5 folder met de nieuwste mode-aanbiedingen en collecties voor het hele gezin.",
		category: "mode",
		seo: {
			folderDay: "donderdag",
			folderDayDetail:
				"De e5 folder en magazines verschijnen per collectie met seizoens- en modeacties.",
			storeCount: "meer dan 100 winkels in België",
			pricePositioning:
				"e5 is een Belgische modeketen met betaalbare collecties voor het hele gezin.",
			loyalty: "e5 klantenkaart met punten, kortingen en persoonlijke acties.",
			appName: "e5 app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 9:30–18:00, koopzondagen per locatie.",
			uniqueSellingPoint:
				"Belgische familiemode met betaalbare seizoenscollecties en frequente acties.",
		},
	},
	{
		slug: "brico",
		name: "Brico",
		logo: "/retailers/brico.svg",
		color: "#E2001A",
		website: "https://www.brico.be",
		description:
			"Bekijk de Brico folder met doe-het-zelf aanbiedingen, gereedschap, verf, tuin en sanitair.",
		category: "doe-het-zelf",
		seo: {
			folderDay: "woensdag",
			folderDayDetail:
				"De Brico folder verschijnt periodiek met acties op klusmateriaal, tuin, verf en sanitair.",
			storeCount: "meer dan 150 winkels in België",
			pricePositioning:
				"Brico is een toonaangevende Belgische doe-het-zelfketen met een breed assortiment en regelmatige acties.",
			loyalty: "Brico Plus-kaart met spaarvoordeel en persoonlijke aanbiedingen.",
			appName: "Brico app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 9:00–18:30, koopzondagen per locatie.",
			uniqueSellingPoint:
				"Breed doe-het-zelf assortiment met sterke acties op gereedschap, tuin en sanitair.",
		},
	},
	{
		slug: "bauhaus",
		name: "Bauhaus",
		logo: "/retailers/bauhaus.svg",
		color: "#E2001A",
		website: "https://www.bauhaus.be",
		description:
			"Bekijk de Bauhaus folder met aanbiedingen in werkplaats, huis, tuin en bouwmaterialen.",
		category: "doe-het-zelf",
		seo: {
			folderDay: "maandag",
			folderDayDetail:
				"De Bauhaus folder verschijnt periodiek met acties op gereedschap, tuin, bouwen en sanitair.",
			storeCount: "vestigingen in België en Nederland",
			pricePositioning:
				"Bauhaus is een specialist in werkplaats, huis en tuin met een zeer breed assortiment en lage prijzen.",
			loyalty: "Bauhaus klantenvoordeel en app.",
			appName: "Bauhaus app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 7:00–20:00; ruime openingsuren.",
			uniqueSellingPoint:
				"Zeer breed specialistenassortiment voor werkplaats, huis en tuin onder één dak.",
		},
	},
	{
		slug: "gifi",
		name: "Gifi",
		logo: "/retailers/gifi.svg",
		color: "#E2001A",
		website: "https://www.gifi.be",
		description:
			"Bekijk de Gifi folder met voordelige aanbiedingen in wonen, decoratie, opbergen en seizoensartikelen.",
		category: "warenhuis",
		seo: {
			folderDay: "tweewekelijks",
			folderDayDetail:
				"De Gifi folder verschijnt tweewekelijks met scherpe acties op wonen, decoratie en huishoud.",
			storeCount: "vestigingen in België en Frankrijk",
			pricePositioning:
				"Gifi is een voordeelwarenhuis met een breed assortiment huis-, woon- en decoratieartikelen tegen lage prijzen.",
			loyalty: "Gifi-acties en nieuwsbrief met aanbiedingen.",
			appName: "Gifi app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 9:00–18:30, koopzondagen per locatie.",
			uniqueSellingPoint:
				"Voordeelwarenhuis met breed woon- en decoratieassortiment tegen lage prijzen.",
		},
	},
	{
		slug: "alvo",
		name: "Alvo",
		logo: "/retailers/alvo.svg",
		color: "#E2001A",
		website: "https://www.alvo.be",
		description:
			"Bekijk de Alvo folder van deze week met de actuele aanbiedingen van je Alvo buurtsupermarkt.",
		category: "supermarkt",
		seo: {
			folderDay: "woensdag",
			folderDayDetail:
				"De Alvo folder verschijnt wekelijks met acties voor de zelfstandige buurtsupermarkt.",
			storeCount: "ruim 100 zelfstandige winkels in België",
			pricePositioning:
				"Alvo is een Belgische groep van zelfstandige buurtsupermarkten met wekelijkse acties en lokale nabijheid.",
			loyalty: "Alvo-getrouwheidskaart en acties per winkel.",
			appName: "Alvo app",
			openingHours:
				"Dagelijks geopend met ruime openingsuren; verschilt per zelfstandige uitbater.",
			uniqueSellingPoint:
				"Zelfstandige Belgische buurtsupermarkten met lokale focus en wekelijkse acties.",
		},
	},
	{
		slug: "supra-bazar",
		name: "Supra Bazar",
		logo: "/retailers/supra-bazar.svg",
		color: "#0067B1",
		website: "https://www.suprabazar.be",
		description:
			"Bekijk de Supra Bazar folder met voordelige aanbiedingen in wonen, vrije tijd, dier en seizoen.",
		category: "warenhuis",
		seo: {
			folderDay: "woensdag",
			folderDayDetail:
				"De Supra Bazar folder verschijnt periodiek met acties op een zeer breed bazar-assortiment.",
			storeCount: "grote winkels in West- en Oost-Vlaanderen",
			pricePositioning:
				"Supra Bazar is een Belgisch megabazar met een enorm assortiment tegen voordeelprijzen.",
			loyalty: "Supra Bazar klantenkaart en acties.",
			appName: "Supra Bazar app",
			openingHours:
				"Maandag t/m zaterdag doorgaans 9:00–18:00, koopzondagen per locatie.",
			uniqueSellingPoint:
				"Megabazar met extreem breed assortiment van wonen tot dier en vrije tijd tegen lage prijzen.",
		},
	},
];

export const nlBorderRetailers: Retailer[] = [];

export const retailers: Retailer[] = retailersBe;

export function getNlBorderRetailerBySlug(slug: string): Retailer | undefined {
	return nlBorderRetailers.find((r) => r.slug === slug);
}

export function getRetailerBySlug(slug: string): Retailer | undefined {
	return (
		retailersBe.find((r) => r.slug === slug) ??
		nlBorderRetailers.find((r) => r.slug === slug)
	);
}

export function getRetailersByCategory(
	category: Retailer["category"],
): Retailer[] {
	return retailers.filter((r) => r.category === category);
}
