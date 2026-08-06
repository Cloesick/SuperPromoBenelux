// ---------------------------------------------------------------------------
// Reject page furniture that the HTML card selector harvests as products.
//
// Sixteen scrapers share the wildcard card selector
// "[data-testid*='product'], [class*='product'], article, li". The `li` and
// `article` arms match navigation lists, cookie-preference panels and footer
// menus, so a scrape of bol returned "Klantenservice" and "Over bol" as
// products, kruidvat returned "Noodzakelijke cookies" and "Zoomniveau
// verhogen", and douglas returned "Pagina 1 van 21" twenty-one times.
//
// Every pattern below is taken from a name actually present in
// data/folders/*.json, not invented. They are matched against the whole
// trimmed name rather than as a prefix, because a fragment rule would reject
// genuine products ("Make-up set van Rituals" must survive while the bare
// category "Make-up" must not).
// ---------------------------------------------------------------------------

/**
 * Whole-name matches. These are complete labels, so anchoring both ends keeps
 * real product names that merely contain the word.
 */
const EXACT_NOISE = new Set(
	[
		// Navigation and footer
		"zoeken",
		"terug",
		"retour",
		"voir tout",
		"alles tonen",
		"alle acties",
		"assortiment",
		"recent bekeken",
		"klantenservice",
		"klantendienst",
		"uitgelicht",
		"populair",
		"acties per categorie",
		"meer informatie",
		"over ons",
		// Bare category tiles
		"make-up",
		"makeup",
		"parfum",
		"bad & lichaam",
		"gezichtsverzorging",
		"haarverzorging",
		"lichaamsverzorging",
		"afslanken",
		"zelfzorg",
		"verschonen",
		"huishouden",
		"cadeaus voor haar",
		"cadeaus voor hem",
		// Marketing headers
		"beauty sale",
		"parfum deals",
		"top seller",
	].map((s) => s.toLowerCase()),
);

/**
 * Patterns for labels that vary. Anchored where the variable part is a
 * suffix, so "Pagina 3 van 21" and "Noodzakelijke cookies" both match without
 * catching a product whose description mentions cookies.
 */
const NOISE_PATTERNS: RegExp[] = [
	// Cookie-consent panels: aveve, kruidvat and di each shipped four of these.
	/^(?:strikt\s+)?(?:noodzakelijke|functionele|prestatie|doelgroepgerichte|reclame|analytische|marketing)\s*cookies?$/i,
	/^(?:uw|jouw|je)\s+privacy$/i,
	/^cookie(?:voorkeuren|instellingen|beleid)$/i,
	// Viewer chrome
	/^pagina\s+\d+\s+van\s+\d+$/i,
	/^page\s+\d+\s+(?:of|sur)\s+\d+$/i,
	/^zoomniveau\s+(?:verhogen|verlagen)$/i,
	// Empty states and error pages
	/^geen\s+(?:producten|alternatieven|resultaten|artikelen|combinaties)\b/i,
	/^(?:je|uw)\s+winkelmandje\s+is\s+leeg/i,
	/aufgerufene\s+seite\s+konnte\s+leider\s+nicht\s+gefunden/i,
	/^(?:deze\s+)?pagina\s+bestaat\s+(?:helaas\s+)?niet/i,
	/^(?:aucun|no)\s+(?:r[ée]sultat|results?|products?)\b/i,
	// Corporate footer links
	/^(?:over|zakendoen\s+met)\s+\w+$/i,
	/^wil\s+je\s+ons\s+volgen/i,
	/^(?:digitale\s+)?flyer\s+bij\b/i,
	// Competition / newsletter calls to action
	/^stem\s+voor\b/i,
	/^schrijf\s+je\s+in\b/i,
	// Category-index tiles. etos renders these as "Alle acties" followed by the
	// category on its own lines, which collapses to one string here.
	/^alle\s+acties\b/i,
	/^populaire?\s+(?:aanbiedingen|acties|producten)$/i,
	/^home$/i,
	/^aantal\s+stuks$/i,
	// Store-section headers, not products.
	/^\w+\s+outlet$/i,
	/^nieuw\s+in\s+(?:onze|de|het)\b/i,
	/^sale\s+op\b/i,
	/^beauty\s+sale\s*[–-]/i,
];

/**
 * True when a scraped name is site furniture rather than a product.
 */
export function isNavigationNoise(name: string | undefined | null): boolean {
	const trimmed = String(name ?? "")
		.replace(/\s+/g, " ")
		.trim();
	if (!trimmed) return true;

	if (EXACT_NOISE.has(trimmed.toLowerCase())) return true;

	for (const pattern of NOISE_PATTERNS) {
		if (pattern.test(trimmed)) return true;
	}

	return false;
}
