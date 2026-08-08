import { describe, expect, it } from "vitest";
import { isNavigationNoise } from "./htmlNoise";

// ---------------------------------------------------------------------------
// Every rejected string below was measured in data/folders/*.json, and every
// accepted one is a real product from the same files. The accepted cases are
// the ones that matter: a filter that eats genuine products costs the site its
// content, and several of these differ from the junk by one word.
// ---------------------------------------------------------------------------

describe("isNavigationNoise — rejects site furniture", () => {
	it("rejects cookie-consent panels", () => {
		// aveve, kruidvat and di each shipped four of these as products.
		for (const name of [
			"Strikt noodzakelijke cookies",
			"Functionele cookies",
			"Prestatiecookies",
			"Doelgroepgerichte cookies",
			"Noodzakelijke cookies",
			"Reclame cookies",
			"Uw privacy",
			"Jouw privacy",
		]) {
			expect(isNavigationNoise(name), name).toBe(true);
		}
	});

	it("rejects navigation and footer links", () => {
		for (const name of [
			"Klantenservice",
			"Over bol",
			"Zakendoen met bol",
			"Wil je ons volgen?",
			"Zoeken",
			"Terug",
			"Retour",
			"Voir tout",
			"Alles tonen",
			"Assortiment",
			"Recent bekeken",
			"HOME",
		]) {
			expect(isNavigationNoise(name), name).toBe(true);
		}
	});

	it("rejects bare category tiles", () => {
		for (const name of [
			"Make-up",
			"Bad & lichaam",
			"Gezichtsverzorging",
			"Haarverzorging",
			"Afslanken",
			"Zelfzorg",
			"Huishouden",
		]) {
			expect(isNavigationNoise(name), name).toBe(true);
		}
	});

	it("rejects viewer chrome", () => {
		// douglas emitted "Pagina N van 21" twenty-one times.
		expect(isNavigationNoise("Pagina 1 van 21")).toBe(true);
		expect(isNavigationNoise("Pagina 17 van 21")).toBe(true);
		expect(isNavigationNoise("Zoomniveau verhogen")).toBe(true);
		expect(isNavigationNoise("Zoomniveau verlagen")).toBe(true);
	});

	it("rejects empty states and error pages", () => {
		for (const name of [
			"Geen producten gevonden",
			"Geen alternatieven gevonden voor dit product.",
			"Je winkelmandje is leeg.",
			"Die aufgerufene Seite konnte leider nicht gefunden werden",
		]) {
			expect(isNavigationNoise(name), name).toBe(true);
		}
	});

	it("rejects category-index tiles even when newlines collapse", () => {
		// etos renders the category on its own lines under "Alle acties".
		expect(isNavigationNoise("Alle acties\n\n\n\n\nLichaamsverzorging")).toBe(true);
		expect(isNavigationNoise("Alle acties\n\n\n\n\nMake-up")).toBe(true);
		expect(isNavigationNoise("Populaire aanbiedingen")).toBe(true);
	});

	it("rejects empty and whitespace-only names", () => {
		expect(isNavigationNoise("")).toBe(true);
		expect(isNavigationNoise("   ")).toBe(true);
		expect(isNavigationNoise(null)).toBe(true);
		expect(isNavigationNoise(undefined)).toBe(true);
	});
});

describe("isNavigationNoise — keeps real products", () => {
	it("keeps genuine product names from the current data", () => {
		for (const name of [
			"AH Verse Vlaamse friet met schil",
			"AH Kumato tomaten",
			"AH Petit Patisserie banket (ongekoeld)",
			"Doritos party packs en Lay's Gourmet",
			"WaterWipes Billendoekjes 12x60 stuks",
			"Pampers Premium Protection Voordeelbox Luiers Maat 5 11-16 kg",
			"Umberto Giannini Curl Jelly Scrunching Jelly 200 ML",
			"Etos Baby Waterdoekjes 60 stuks",
			"Liefmans On the rocks",
			"Entreeticket Ouwehands Dierenpark",
		]) {
			expect(isNavigationNoise(name), name).toBe(false);
		}
	});

	it("keeps products whose names contain a category word", () => {
		// The category tiles are rejected as whole names, so a product that
		// merely mentions them must survive.
		expect(isNavigationNoise("Rituals Make-up remover 200ml")).toBe(false);
		expect(isNavigationNoise("Nivea Gezichtsverzorging dagcreme")).toBe(false);
		expect(isNavigationNoise("Parfum Chanel No 5 50ml")).toBe(false);
	});

	it("keeps products that mention cookies as food", () => {
		// "cookies" is a product category in Dutch supermarkets too.
		expect(isNavigationNoise("Lotus Biscoff cookies 250g")).toBe(false);
		expect(isNavigationNoise("Milka cookies met chocolade")).toBe(false);
	});
});
