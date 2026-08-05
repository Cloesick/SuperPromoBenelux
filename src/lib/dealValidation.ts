import { Deal } from "./types";

// ---------------------------------------------------------------------------
// Deal salvage + validation
//
// Scraped deals arrive from four very different pipelines (HTML selectors,
// JSON-LD, PDF text, page text) and their quality varies wildly. Before a deal
// reaches the database it goes through two stages:
//
//   1. salvageDeal()  — recover prices that the extractors captured into the
//                       discount label but never parsed (e.g. "voor0.99")
//   2. validateDeal() — reject rows that are not products at all: CSS rules,
//                       navigation text, legal boilerplate, absurd prices
//
// This matters because historical price data is a *truth claim*. A wrong
// "lowest price ever" is worse than no claim, so anything we cannot parse
// confidently is dropped rather than guessed.
// ---------------------------------------------------------------------------

export interface ValidationResult {
	ok: boolean;
	/** Machine-readable rejection reason; undefined when ok. */
	reason?: string;
}

/** Prices outside this range are parse artefacts, not real promo prices. */
export const MIN_PRICE = 0.01;
export const MAX_PRICE = 50_000;

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 120;

// ---------------------------------------------------------------------------
// European price parsing
// ---------------------------------------------------------------------------

/**
 * Parse a European-formatted price string to a number.
 *
 * Handles the three formats that appear in Belgian leaflets:
 *   "1.499,00" → 1499     (dot = thousands, comma = decimal)
 *   "49,99"    → 49.99    (comma = decimal)
 *   "49.99"    → 49.99    (dot = decimal)
 *
 * Returns undefined when the input is not a parseable price.
 */
export function parseEuroPrice(raw: string | undefined | null): number | undefined {
	if (!raw) return undefined;
	let s = String(raw).replace(/[€\s]/g, "");
	if (!/\d/.test(s)) return undefined;

	const lastDot = s.lastIndexOf(".");
	const lastComma = s.lastIndexOf(",");

	if (lastDot !== -1 && lastComma !== -1) {
		// Both present — whichever comes last is the decimal separator.
		if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
		else s = s.replace(/,/g, "");
	} else if (lastComma !== -1) {
		// Comma only: decimal separator unless it looks like a thousands group
		// ("1,499" with exactly 3 trailing digits).
		const after = s.length - lastComma - 1;
		s = after === 3 ? s.replace(/,/g, "") : s.replace(",", ".");
	}

	const val = parseFloat(s);
	if (!Number.isFinite(val)) return undefined;
	return val;
}

/** True when a price is within the plausible range for a retail promo. */
export function isPlausiblePrice(v: number | undefined | null): boolean {
	return typeof v === "number" && Number.isFinite(v) && v >= MIN_PRICE && v <= MAX_PRICE;
}

// ---------------------------------------------------------------------------
// Salvage: recover prices stranded in the discount label
// ---------------------------------------------------------------------------

export interface SalvagedPrices {
	promoPrice?: number;
	originalPrice?: number;
	/** Units required to obtain promoPrice, e.g. 3 for "3 voor 5.00". */
	quantity?: number;
}

/**
 * Extract prices from a discount label.
 *
 * Albert Heijn and others emit labels that contain the actual price but which
 * the extractors never parsed — "voor0.99", "3 voor5.00", "van 2,99 voor 1,99".
 * Roughly 40% of price-less rows in the database are recoverable this way.
 *
 * Labels that express a *reduction* rather than a price ("€1korting", "-30%",
 * "1+1 gratis") intentionally yield nothing: the absolute price is unknown.
 */
export function salvagePricesFromLabel(label: string | undefined | null): SalvagedPrices {
	if (!label) return {};
	const s = String(label).toLowerCase().replace(/\s+/g, " ").trim();

	// A reduction, not a price — the absolute value cannot be derived.
	if (/korting|réduction|reduction|gratis|gratuit|\d\s*%/.test(s)) return {};

	const NUM = "\\d+(?:[.,]\\d+)?";

	// "van 2,99 voor 1,99" / "de 2,99 pour 1,99" — both prices present.
	const both = s.match(
		new RegExp(`(?:van|de)\\s*€?\\s*(${NUM})\\s*(?:voor|pour|for)\\s*€?\\s*(${NUM})`),
	);
	if (both) {
		const originalPrice = parseEuroPrice(both[1]);
		const promoPrice = parseEuroPrice(both[2]);
		if (isPlausiblePrice(promoPrice)) {
			return isPlausiblePrice(originalPrice) && originalPrice! > promoPrice!
				? { promoPrice, originalPrice }
				: { promoPrice };
		}
		return {};
	}

	// "3 voor 5.00" / "2 pour 5,00" — bundle price for N units.
	const multi = s.match(new RegExp(`^(\\d+)\\s*(?:voor|pour|for)\\s*€?\\s*(${NUM})$`));
	if (multi) {
		const quantity = parseInt(multi[1], 10);
		const promoPrice = parseEuroPrice(multi[2]);
		if (isPlausiblePrice(promoPrice) && quantity > 0) return { promoPrice, quantity };
		return {};
	}

	// "voor0.99" / "voor 1,99" / "pour 2,50" — single promo price.
	const single = s.match(new RegExp(`^(?:voor|pour|for)\\s*€?\\s*(${NUM})$`));
	if (single) {
		const promoPrice = parseEuroPrice(single[1]);
		if (isPlausiblePrice(promoPrice)) return { promoPrice };
	}

	return {};
}

/**
 * Return a copy of the deal with any recoverable prices filled in.
 * Never overwrites a price the extractor already found.
 */
export function salvageDeal(deal: Deal): Deal {
	if (isPlausiblePrice(deal.promoPrice)) return deal;

	const salvaged = salvagePricesFromLabel(deal.discount);
	if (salvaged.promoPrice === undefined) return deal;

	return {
		...deal,
		promoPrice: salvaged.promoPrice,
		originalPrice: isPlausiblePrice(deal.originalPrice)
			? deal.originalPrice
			: salvaged.originalPrice,
	};
}

// ---------------------------------------------------------------------------
// Rejection patterns
// ---------------------------------------------------------------------------

/** Inline CSS/SVG scraped as a product name, e.g. ".st0{fill:#A6A6A6;}". */
const CSS_RE =
	/\{[^}]*(?:fill|stroke|color|font|margin|padding|width|height|display|background)\s*:/i;

/** Navigation, consent and empty-state strings from retailer sites. */
const UI_NOISE_RE =
	/^(?:kies|choisir|select|geen\s+(?:alternatieven|resultaten|producten)|aucun|no\s+(?:results|products)|bekijk|voir|meer\s+info|lees\s+meer|inloggen|aanmelden|winkelmand|panier|zoeken|rechercher|filter|sorteer|trier|volgende|vorige|suivant|précédent|cookie|privacy|algemene\s+voorwaarden|menu|footer|header)\b/i;

/** Regulatory / legal boilerplate that leaks in from PDF text layers. */
const LEGAL_RE =
	/(?:ausgestellt|verzeichnis\s+der\s+erzeugnisse|allgemeine\s+geschäftsbedingungen|conditions\s+générales|algemene\s+voorwaarden|btw[- ]nummer|tva|ondernemingsnummer|verantwoordelijke\s+uitgever|éditeur\s+responsable|alcoholmisbr?ui?k\s+schaadt|l'abus\s+d'alcool)/i;

/**
 * Detect names that are OCR noise rather than products.
 *
 * Low-resolution leaflet captures yield fragments like "sg | | Hamel" or
 * "RE Se ee tn be aen eend" — these contain letters, are not CSS or navigation
 * text, and sit within the length bounds, so every other rule passes them.
 * They are recognisable instead by shape: mostly one- and two-character
 * tokens, a low proportion of letters, and no substantial word.
 */
export function looksLikeOcrNoise(name: string): boolean {
	const trimmed = name.trim();
	if (!trimmed) return true;

	const tokens = trimmed.split(/\s+/);

	// A real product name contains at least one substantial, mostly-alphabetic
	// word ("Hamburgers", "Artois", "bakaardappeltjes").
	const hasSubstantialWord = tokens.some((t) => {
		const letters = (t.match(/\p{L}/gu) ?? []).length;
		return t.length >= 4 && letters / t.length >= 0.8;
	});
	if (!hasSubstantialWord) return true;

	// Fragmented output is dominated by tiny tokens.
	const shortTokens = tokens.filter((t) => t.length <= 2).length;
	if (tokens.length >= 4 && shortTokens / tokens.length > 0.45) return true;

	// Letters should dominate over digits and stray symbols.
	const nonSpace = trimmed.replace(/\s/g, "");
	const letters = (nonSpace.match(/\p{L}/gu) ?? []).length;
	if (nonSpace.length > 0 && letters / nonSpace.length < 0.5) return true;

	return false;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Decide whether a deal is fit to store.
 *
 * Call salvageDeal() first — validation assumes prices have already been
 * recovered where possible.
 */
export function validateDeal(deal: Deal): ValidationResult {
	const name = (deal.product ?? "").trim();

	if (name.length < MIN_NAME_LENGTH) return { ok: false, reason: "name_too_short" };
	if (name.length > MAX_NAME_LENGTH) return { ok: false, reason: "name_too_long" };
	if (!/\p{L}/u.test(name)) return { ok: false, reason: "name_has_no_letters" };
	if (CSS_RE.test(name)) return { ok: false, reason: "name_is_css" };
	if (UI_NOISE_RE.test(name)) return { ok: false, reason: "name_is_ui_noise" };
	if (LEGAL_RE.test(name)) return { ok: false, reason: "name_is_legal_boilerplate" };
	if (looksLikeOcrNoise(name)) return { ok: false, reason: "name_is_ocr_noise" };
	if (isLeafletFragment(name)) return { ok: false, reason: "name_is_leaflet_fragment" };

	const hasPromo = isPlausiblePrice(deal.promoPrice);
	const hasOriginal = isPlausiblePrice(deal.originalPrice);

	// A price that parsed but landed outside the plausible range is a parse
	// artefact — treat it as a hard failure rather than silently dropping it,
	// so it cannot masquerade as a price-less promo.
	if (deal.promoPrice != null && !hasPromo) return { ok: false, reason: "promo_price_implausible" };
	if (deal.originalPrice != null && !hasOriginal)
		return { ok: false, reason: "original_price_implausible" };

	if (hasPromo && hasOriginal && deal.promoPrice! > deal.originalPrice!) {
		return { ok: false, reason: "promo_exceeds_original" };
	}

	// Without a price, only a genuine non-price promo mechanic is worth storing
	// (BOGO, multi-buy, percentage). Anything else carries no information.
	if (!hasPromo && !hasOriginal) {
		const label = (deal.discount ?? "").toLowerCase();
		const isRealMechanic =
			/\d\s*%|gratis|gratuit|\d\s*\+\s*\d|halve\s*prijs|demi[- ]prix|korting|réduction/.test(
				label,
			);
		if (!isRealMechanic) return { ok: false, reason: "no_price_and_no_mechanic" };
	}

	return { ok: true };
}

/** Leaflet furniture: annotations that surround a promo but never name it. */
// The colon-terminated forms must not carry \b: the character after ":" is a
// space, and a boundary between two non-word characters never matches.
const FRAGMENT_PREFIX_RE =
	/^(?:(?:vb|bijv|bv|p\.?\s*ex)\.?\s*:|(?:in\s+je\s+winkel|combineer|vanaf|volledig\s+assortiment|uitgezonderd|geldig|per\s+stuk|statiegeld)\b)/i;

/**
 * Container and packaging nouns. On their own these are the unit a promo is
 * sold in, not the product — a card reading "bakken" is the tail of a promo
 * whose brand sits in an image the OCR never saw.
 */
const CONTAINER_NOUNS = new Set([
	"bokalen",
	"bakken",
	"blikken",
	"flessen",
	"verpakkingen",
	"packs",
	"partyboxen",
	"stuks",
	"stuk",
	"dozen",
	"zakken",
	"potten",
	"brikken",
	"statiegeld",
	"assortiment",
	"bouteilles",
	"boîtes",
	"emballages",
]);

/**
 * True when a name is leaflet annotation rather than a product.
 *
 * These survive every other rule: they are real Dutch or French words at
 * plausible length with a healthy letter ratio. Only their meaning disqualifies
 * them, so they are matched explicitly.
 */
export function isLeafletFragment(name: string): boolean {
	const trimmed = name.trim().replace(/[.,;:]+$/, "");
	if (!trimmed) return true;

	if (FRAGMENT_PREFIX_RE.test(trimmed)) return true;

	// Every token is a generic container noun -> no product identity present.
	const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length > 0 && tokens.length <= 3 && tokens.every((t) => CONTAINER_NOUNS.has(t))) {
		return true;
	}

	return false;
}

export interface SanitizeReport {
	kept: Deal[];
	rejected: { deal: Deal; reason: string }[];
	salvagedCount: number;
}

/**
 * Salvage then validate a batch of deals, reporting what was dropped and why.
 * Rejection reasons are aggregated by the caller for scrape-run logging.
 */
export function sanitizeDeals(deals: Deal[]): SanitizeReport {
	const kept: Deal[] = [];
	const rejected: { deal: Deal; reason: string }[] = [];
	let salvagedCount = 0;

	for (const original of deals) {
		const deal = salvageDeal(original);
		if (deal.promoPrice !== original.promoPrice) salvagedCount++;

		const result = validateDeal(deal);
		if (result.ok) kept.push(deal);
		else rejected.push({ deal, reason: result.reason ?? "unknown" });
	}

	return { kept, rejected, salvagedCount };
}
