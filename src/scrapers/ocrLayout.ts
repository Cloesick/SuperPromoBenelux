import { Deal } from "../lib/types";
import { parseEuroPrice, isPlausiblePrice } from "../lib/dealValidation";

// ---------------------------------------------------------------------------
// Spatial clustering of OCR words into product cards
//
// Tesseract returns a flat reading order, but a leaflet is a two-dimensional
// grid. On a Colruyt page its layout analysis collapses the whole spread into
// a single block, so reading order sweeps across adjacent columns and glues
// unrelated products together: a name from column 1 ends up beside a price
// from column 3.
//
// Word bounding boxes still carry the real structure. This module rebuilds
// product cards from geometry — words that sit close together belong to the
// same promo — and parses each card in isolation, so a name can only ever pair
// with a price that was physically next to it.
//
// The clustering core is deliberately free of any tesseract.js dependency: it
// operates on plain {text, bbox, confidence} records so it can be unit tested
// with hand-built layouts.
// ---------------------------------------------------------------------------

export interface BBox {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export interface OcrWord {
	text: string;
	bbox: BBox;
	confidence: number;
}

export interface WordCluster {
	words: OcrWord[];
	bbox: BBox;
	/** Words joined in reading order *within the cluster* (top-to-bottom, left-to-right). */
	text: string;
}

export interface ClusterOptions {
	/** Words below this confidence are dropped before clustering. */
	minWordConfidence?: number;
	/** Horizontal gap tolerance, as a multiple of median word height. */
	xGapFactor?: number;
	/** Vertical gap tolerance, as a multiple of median word height. */
	yGapFactor?: number;
	/** Clusters with fewer words than this are discarded as stray marks. */
	minWordsPerCluster?: number;
}

const DEFAULTS: Required<ClusterOptions> = {
	minWordConfidence: 60,
	xGapFactor: 1.6,
	yGapFactor: 1.1,
	minWordsPerCluster: 2,
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function boxHeight(b: BBox): number {
	return Math.max(0, b.y1 - b.y0);
}

export function mergeBoxes(a: BBox, b: BBox): BBox {
	return {
		x0: Math.min(a.x0, b.x0),
		y0: Math.min(a.y0, b.y0),
		x1: Math.max(a.x1, b.x1),
		y1: Math.max(a.y1, b.y1),
	};
}

/** Horizontal overlap in pixels; negative values are the gap between boxes. */
export function horizontalOverlap(a: BBox, b: BBox): number {
	return Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
}

/** Vertical overlap in pixels; negative values are the gap between boxes. */
export function verticalOverlap(a: BBox, b: BBox): number {
	return Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
}

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((x, y) => x - y);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Decide whether two words belong to the same card.
 *
 * Two cases are accepted:
 *   - side by side on a line: vertical ranges overlap and the horizontal gap
 *     is small relative to text size
 *   - stacked lines of one card: horizontal ranges overlap and the vertical
 *     gap is small
 *
 * Requiring overlap on the perpendicular axis is what stops adjacent columns
 * from merging: two prices on the same row but in different columns are far
 * apart horizontally, and two cards in one column are separated by whitespace
 * wider than a line gap.
 */
export function areAdjacent(
	a: OcrWord,
	b: OcrWord,
	unit: number,
	opts: Required<ClusterOptions>,
): boolean {
	const maxXGap = unit * opts.xGapFactor;
	const maxYGap = unit * opts.yGapFactor;

	// Same line, horizontally near.
	if (verticalOverlap(a.bbox, b.bbox) > 0) {
		const xGap = -horizontalOverlap(a.bbox, b.bbox);
		if (xGap <= maxXGap) return true;
	}

	// Stacked lines, vertically near.
	if (horizontalOverlap(a.bbox, b.bbox) > 0) {
		const yGap = -verticalOverlap(a.bbox, b.bbox);
		if (yGap <= maxYGap) return true;
	}

	return false;
}

// ---------------------------------------------------------------------------
// Clustering (union-find over the adjacency relation)
// ---------------------------------------------------------------------------

function makeUnionFind(n: number) {
	const parent = Array.from({ length: n }, (_, i) => i);
	const find = (i: number): number => {
		while (parent[i] !== i) {
			parent[i] = parent[parent[i]];
			i = parent[i];
		}
		return i;
	};
	const union = (i: number, j: number): void => {
		const a = find(i);
		const b = find(j);
		if (a !== b) parent[b] = a;
	};
	return { find, union };
}

/** Order words the way a person reads a single card: by row, then left to right. */
function readingOrder(words: OcrWord[], unit: number): OcrWord[] {
	return [...words].sort((a, b) => {
		const rowA = Math.round(a.bbox.y0 / Math.max(unit, 1));
		const rowB = Math.round(b.bbox.y0 / Math.max(unit, 1));
		return rowA - rowB || a.bbox.x0 - b.bbox.x0;
	});
}

/**
 * Group words into spatially coherent clusters.
 * Pairwise comparison is O(n^2); a leaflet page yields ~500 words, so the
 * ~125k comparisons are negligible next to OCR itself.
 */
export function clusterWords(words: OcrWord[], options: ClusterOptions = {}): WordCluster[] {
	const opts = { ...DEFAULTS, ...options };

	const usable = words.filter(
		(w) => w.text.trim().length > 0 && w.confidence >= opts.minWordConfidence,
	);
	if (usable.length === 0) return [];

	const unit = median(usable.map((w) => boxHeight(w.bbox))) || 1;
	const { find, union } = makeUnionFind(usable.length);

	for (let i = 0; i < usable.length; i++) {
		for (let j = i + 1; j < usable.length; j++) {
			if (areAdjacent(usable[i], usable[j], unit, opts)) union(i, j);
		}
	}

	const groups = new Map<number, OcrWord[]>();
	usable.forEach((word, i) => {
		const root = find(i);
		const list = groups.get(root);
		if (list) list.push(word);
		else groups.set(root, [word]);
	});

	const clusters: WordCluster[] = [];
	for (const members of groups.values()) {
		if (members.length < opts.minWordsPerCluster) continue;
		const ordered = readingOrder(members, unit);
		clusters.push({
			words: ordered,
			bbox: ordered.map((w) => w.bbox).reduce(mergeBoxes),
			text: ordered.map((w) => w.text).join(" ").replace(/\s+/g, " ").trim(),
		});
	}

	// Top-to-bottom, left-to-right across the page.
	return clusters.sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
}

// ---------------------------------------------------------------------------
// Cluster -> Deal
// ---------------------------------------------------------------------------

/**
 * A price must carry an explicit decimal separator or euro sign.
 *
 * Leaflets often render cents as superscript, which OCRs as "549" for EUR 5.49.
 * Those are deliberately not matched: guessing the decimal position would
 * invent prices, and this data underpins historical-low claims.
 */
/*
 * The lookarounds reject a group that is part of a longer dotted or
 * comma-grouped number. Without them "Your IP: 193.74.248.194" yielded 193.74,
 * and a Boots anti-bot block page was stored as a EUR 45.60 deal reduced from
 * EUR 193.74 — built out of two IP addresses, and the only data that retailer
 * had. Thousands separators broke the same way: "1.499,00" matched as 499,00,
 * which is where krefel's EUR 1.49-from-EUR-799 rows came from.
 *
 * The cost is that a four-figure price printed without a euro sign now yields
 * nothing rather than a wrong value. That is the correct trade here: a wrong
 * price is worse than no price.
 */
const PRICE_RE =
	/€\s*\d{1,4}(?:[.,]\d{1,2})?|(?<![\d.,])\d{1,4}[.,]\d{2}(?![.,]?\d)/g;

export function findPricesInText(text: string): number[] {
	const matches = text.match(PRICE_RE) ?? [];
	return matches
		.map((m) => parseEuroPrice(m))
		.filter((v): v is number => isPlausiblePrice(v));
}

/**
 * Unit-price markers. Belgian leaflets print the pack price beside a
 * per-litre/per-kilo equivalent — "5,99  (/L) 1,33" — and the two are not a
 * discount pair. Treating a unit price as the "was" price manufactures absurd
 * reductions (a EUR 2.80 Corona shown as reduced from EUR 21.98).
 */
const UNIT_MARKER_RE = /^\(?\/(?:l|kg|g|ml|cl|st|stuk|stk|liter|kilo|piece)\)?$/i;

/** Largest original/promo ratio treated as a genuine discount (~80% off). */
export const MAX_DISCOUNT_RATIO = 5;

/**
 * Extract prices from a cluster's words, skipping any that a unit marker
 * identifies as a per-unit equivalent rather than a shelf price.
 */
export function findPricesInWords(words: OcrWord[]): number[] {
	const prices: number[] = [];

	for (let i = 0; i < words.length; i++) {
		const token = words[i].text.trim();

		// "(/L)" attached to the previous token marks *that* price as per-unit.
		if (UNIT_MARKER_RE.test(token)) {
			prices.pop();
			continue;
		}

		const matches = token.match(PRICE_RE);
		PRICE_RE.lastIndex = 0;
		if (!matches) continue;

		// A price written as "1,33/L" is per-unit in a single token.
		if (/\/\s*(?:l|kg|g|ml|cl|st|stuk|liter|kilo)\b/i.test(token)) continue;

		for (const m of matches) {
			const v = parseEuroPrice(m);
			if (isPlausiblePrice(v)) prices.push(v!);
		}
	}

	return prices;
}

/** Words that are pure price/quantity noise rather than part of a product name. */
const NAME_STOP_RE =
	/^(?:€|\d+[.,]?\d*|\/|\/kg|\/l|\/st|\/stuk|per|van|voor|pour|de|à|a|of|ou|nu|maintenant|korting|réduction|actie|promo|weekactie|gratis|gratuit)$/i;

/**
 * Recover a product name from a cluster: the longest run of consecutive
 * word-like tokens. Prices and unit markers break the run, which keeps names
 * from absorbing the price grid that surrounds them.
 */
export function extractProductName(cluster: WordCluster): string {
	let best: string[] = [];
	let current: string[] = [];

	for (const w of cluster.words) {
		const t = w.text.trim();
		const isWord = /\p{L}/u.test(t) && !NAME_STOP_RE.test(t) && !PRICE_RE.test(t);
		PRICE_RE.lastIndex = 0; // PRICE_RE is global; reset between tests

		if (isWord) {
			current.push(t);
			if (current.length > best.length) best = [...current];
		} else {
			current = [];
		}
	}

	return cleanProductName(best.join(" "));
}

/** Orphan unit tokens left at the head of a name by the line above it. */
const LEADING_UNIT_RE =
	/^(?:ml|cl|dl|l|g|kg|gr|st|stuk|stuks|vol|in|je|van|de|het|per|met|of|ou|et|en)\b[\s,.:-]*/i;

/**
 * Tidy a name recovered from leaflet geometry.
 *
 * Two artefacts dominate:
 *   - "vb.:" ("bijvoorbeeld", e.g.) introduces the example product, so the
 *     useful name is what follows it, not what precedes it
 *   - the tail of the line above leaks in as a leading unit token
 *     ("ml vb.: Mosterd...", "g vb.: Mascarpone...")
 */
export function cleanProductName(raw: string): string {
	let name = raw.trim();

	// Keep the part after an "e.g." marker, wherever it appears.
	const eg = name.match(/(?:vb|bijv|bv|p\.?\s*ex)\.?\s*:\s*(.+)$/i);
	if (eg?.[1]) name = eg[1].trim();

	// Strip leading orphan units, repeatedly ("g vol in blik" -> "blik").
	let previous: string;
	do {
		previous = name;
		name = name.replace(LEADING_UNIT_RE, "").trim();
	} while (name !== previous && name.length > 0);

	// Drop an unmatched opening bracket left by a truncated qualifier.
	name = name.replace(/\s*\([^)]*$/, "").trim();

	return name.replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "").trim();
}

/**
 * Convert one cluster into a Deal.
 *
 * Returns null unless the cluster contains both a usable name and at least one
 * price — a card with only a price, or only text, is not a promo we can state
 * anything true about. When two or more prices are present the lowest is taken
 * as the promo price and the highest as the original, which is how leaflets
 * present a strikethrough pair.
 */
export function clusterToDeal(
	cluster: WordCluster,
	retailerSlug: string,
	validFrom: string,
	validUntil: string,
	index: number,
): Deal | null {
	const product = extractProductName(cluster);
	if (product.length < 3) return null;

	const prices = findPricesInWords(cluster.words);
	if (prices.length === 0) return null;

	const promoPrice = Math.min(...prices);
	const highest = Math.max(...prices);

	// Only accept a second price as the "before" price when the implied
	// discount is credible. Leaflet cards carry unit prices, multi-buy totals
	// and neighbouring figures that a bare max() would misread as an original.
	const originalPrice =
		prices.length > 1 && highest > promoPrice && highest / promoPrice <= MAX_DISCOUNT_RATIO
			? highest
			: undefined;

	return {
		id: `${retailerSlug}-ocrlayout-${index}`,
		product,
		promoPrice,
		originalPrice,
		validFrom,
		validUntil,
		retailerSlug,
	};
}

/**
 * Full pipeline: words -> spatial clusters -> deals.
 * Output still passes through sanitizeDeals() before storage.
 */
export function dealsFromWords(
	words: OcrWord[],
	retailerSlug: string,
	validFrom: string,
	validUntil: string,
	options: ClusterOptions = {},
): Deal[] {
	const clusters = clusterWords(words, options);
	const deals: Deal[] = [];

	clusters.forEach((cluster, i) => {
		const deal = clusterToDeal(cluster, retailerSlug, validFrom, validUntil, i);
		if (deal) deals.push(deal);
	});

	return deals;
}
