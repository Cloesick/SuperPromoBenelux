import { Retailer } from "./types";

export const retailersBe: Retailer[] = [
	{
		slug: "albert-heijn",
		name: "Albert Heijn",
		logo: "/retailers/albert-heijn.png",
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
		logo: "/retailers/lidl.png",
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
		logo: "/retailers/delhaize.png",
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
		logo: "/retailers/colruyt.png",
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
		logo: "/retailers/aldi.svg",
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
		logo: "/retailers/action.svg",
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
