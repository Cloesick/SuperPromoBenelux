// ---------------------------------------------------------------------------
// Products out of Lidl's `data-grid-data` payload.
//
// Lidl's weekly promo page carries no product JSON-LD — the only schema.org on
// it is Organization/MemberProgram — and the prices never reach the DOM in a
// form a CSS selector can read. They ride in as HTML-escaped JSON on
// `data-grid-data` attributes (89 of them on a typical week), which the client
// hydrates into the grid.
//
// The practical consequence: `priceSelectors` matched nothing, the run produced
// zero priced deals, and the harvest guard binned it as "a thinner result".
// That looks identical to a quiet promo week, so the scraper sat blind from
// early August 2026 until someone read the stored folder's validUntil.
//
// Prices hang off `lidlPlus[].price` rather than the product's own `price`,
// which only carries currency metadata:
//
//   { fullTitle: "Witloof",
//     lidlPlus: [ { price: { price: 1.85,
//                            oldPrice: 3.7,
//                            discount: { deletedPrice: 3.7,
//                                        discountText: "1 + 1 GRATIS" },
//                            basePrice: { text: "2 x 500 g - 1,85 EUR/kg" } } } ] }
//
// so the walk looks for any nested object holding a numeric `price.price`
// rather than hard-coding that path — Lidl moves this around between page
// types, and a missed rename here fails silently in exactly the way that cost
// three weeks last time.
//
// Parsing lives here rather than inside `page.evaluate` for the same reason
// jsonLdDeals does: the same code then serves a live page and a fetched HTML
// string, and it is unit-testable without a browser.
// ---------------------------------------------------------------------------

import { Deal } from "../lib/types";

export interface LidlGridContext {
	retailerSlug: string;
	validFrom: string;
	validUntil: string;
}

/** Prices arrive as numbers here, but "3,70" turns up on some page types. */
function toPrice(value: unknown): number | undefined {
	if (value == null) return undefined;
	const n =
		typeof value === "number"
			? value
			: parseFloat(String(value).replace(",", "."));
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

function str(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

interface PriceParts {
	promoPrice?: number;
	originalPrice?: number;
	discount?: string;
	basePriceText?: string;
}

/**
 * A price node is any object with a numeric `price`. Returning the first one
 * found means a product with several Lidl Plus tiers reports its headline
 * offer, which is what the folder advertises.
 */
function priceFrom(node: Record<string, unknown>): PriceParts | undefined {
	const promoPrice = toPrice(node.price);
	if (promoPrice === undefined) return undefined;

	const discount =
		node.discount && typeof node.discount === "object"
			? (node.discount as Record<string, unknown>)
			: {};
	const basePrice =
		node.basePrice && typeof node.basePrice === "object"
			? (node.basePrice as Record<string, unknown>)
			: {};

	return {
		promoPrice,
		originalPrice: toPrice(node.oldPrice) ?? toPrice(discount.deletedPrice),
		discount: str(discount.discountText),
		basePriceText: str(basePrice.text),
	};
}

/** Depth-first hunt for the first price node beneath a product. */
function findPrice(node: unknown, depth = 0): PriceParts | undefined {
	if (depth > 6 || !node || typeof node !== "object") return undefined;
	if (Array.isArray(node)) {
		for (const child of node) {
			const hit = findPrice(child, depth + 1);
			if (hit) return hit;
		}
		return undefined;
	}
	const obj = node as Record<string, unknown>;
	const direct = priceFrom(obj);
	if (direct) return direct;
	for (const value of Object.values(obj)) {
		if (value && typeof value === "object") {
			const hit = findPrice(value, depth + 1);
			if (hit) return hit;
		}
	}
	return undefined;
}

/** The blurb carrying "€ 3,70 - € 1,85 voor. 2 packs" sits under keyfacts. */
function findSupplemental(node: unknown, depth = 0): string | undefined {
	if (depth > 4 || !node || typeof node !== "object") return undefined;
	if (Array.isArray(node)) {
		for (const child of node) {
			const hit = findSupplemental(child, depth + 1);
			if (hit) return hit;
		}
		return undefined;
	}
	const obj = node as Record<string, unknown>;
	const own = str(obj.supplementalDescription);
	if (own) return own;
	for (const value of Object.values(obj)) {
		if (value && typeof value === "object") {
			const hit = findSupplemental(value, depth + 1);
			if (hit) return hit;
		}
	}
	return undefined;
}

export function dealsFromLidlGrid(
	blocks: string[],
	ctx: LidlGridContext,
): Deal[] {
	const deals: Deal[] = [];
	const seen = new Set<string>();

	const visit = (node: unknown) => {
		if (Array.isArray(node)) {
			node.forEach(visit);
			return;
		}
		if (!node || typeof node !== "object") return;
		const obj = node as Record<string, unknown>;

		const product = str(obj.fullTitle) ?? str(obj.title);
		// `havingPrice: false` products are catalogue filler, not this week's promo.
		if (product && obj.havingPrice !== false) {
			const price = findPrice(obj.lidlPlus ?? obj);
			if (price?.promoPrice !== undefined) {
				// itemId is stable across a week; fall back to the name plus price so
				// two variants of one product do not collapse into a single row.
				const key = String(
					obj.itemId ?? obj.erpNumber ?? `${product}|${price.promoPrice}`,
				);
				if (!seen.has(key)) {
					seen.add(key);
					deals.push({
						id: `lidl-grid-${key}`,
						product,
						promoPrice: price.promoPrice,
						originalPrice: price.originalPrice,
						discount: price.discount,
						description: findSupplemental(obj) ?? price.basePriceText,
						category: str(obj.analyticsCategory) ?? str(obj.category),
						imageUrl: str(obj.image),
						affiliateUrl: str(obj.canonicalUrl),
						validFrom: ctx.validFrom,
						validUntil: ctx.validUntil,
						retailerSlug: ctx.retailerSlug,
					});
				}
			}
		}

		// Keep descending regardless: grids nest products inside carousels and
		// `additionalHighlightProducts`, so matching one must not end the walk.
		for (const value of Object.values(obj)) {
			if (value && typeof value === "object") visit(value);
		}
	};

	for (const block of blocks) {
		try {
			visit(JSON.parse(block));
		} catch {
			// One malformed attribute must not discard the other 88.
		}
	}

	return deals;
}

/**
 * Pulls and unescapes the `data-grid-data` attribute bodies out of HTML.
 * The attribute is double-encoded — `&quot;` for every JSON quote — so the
 * entities have to come off before JSON.parse sees it.
 */
export function lidlGridBlocks(html: string): string[] {
	const out: string[] = [];
	const re = /data-grid-data="([\s\S]*?)"(?=\s|>|\/>)/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html)) !== null) out.push(unescapeHtml(m[1]));
	return out;
}

function unescapeHtml(s: string): string {
	return s
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&"); // last, so &amp;quot; does not become a quote
}
