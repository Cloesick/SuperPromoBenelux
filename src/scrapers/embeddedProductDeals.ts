// ---------------------------------------------------------------------------
// Products out of whatever JSON a page happens to embed.
//
// After Lidl, the obvious next move looked like "one extractor for every site
// that sets a window.__* global". That premise did not survive contact:
//
//   brico    window.__FABRICS__ is a namespace initialiser (`|| {}`); the 4029
//            "items" on the promo page are nav menu links, and every price-ish
//            key is a CMS label ("halfPriceTitle"). No products on that page.
//   bol      window.__reactRouterContext carries routing, no catalogue.
//   zooplus  window.__SINGLETONS, likewise nothing priced.
//   medpets  GTM dataLayer.push, 24 products with a flat `price`.
//   di       inline product JSON with a nested price object.
//
// So the shared thing is not a global name. It is that both working cases embed
// product JSON *somewhere* in the document and hydrate from it. This module
// looks for product-shaped objects across every JSON-ish region of a page, and
// is deliberately strict about what counts as one: a resolvable positive price
// AND a name. Requiring the price is what stops brico's navigation tree — which
// has titles, urls and nested items but no prices — from arriving as 4000 deals.
//
// Two price layouts are handled because two are what exist in the wild:
//
//   flat    { name: "Orozyme Kauwstrips", price: 7.40 }              medpets
//   nested  { price: { valueWithTax: 10.46,                          di
//                      baseValueWithTax: 13.95,
//                      options: { discountDetail: "-25%" } } }
//
// The two also disagree about where the *name* lives. Medpets puts it beside
// the price; di keeps the price at the root and the title one level down under
// `common`. So identity is read from the price-bearing node or from a named
// container beneath it — a closed list, not any child object. Di also ships a
// `typology` sibling with its own `name` and `title`, and a generic "first
// child with a name wins" rule would happily label every product "Produit
// Enrichi".
//
// A retailer whose data only appears after hydration will still yield nothing
// here, and that is the correct answer rather than something to work around:
// the fix for those is the XHR endpoint, not a cleverer regex.
// ---------------------------------------------------------------------------

import { Deal } from "../lib/types";

export interface EmbeddedContext {
	retailerSlug: string;
	validFrom: string;
	validUntil: string;
}

const NAME_KEYS = [
	"name",
	"title",
	"productName",
	"fullTitle",
	"displayName",
	"item_name",
];

/** Keys whose value holds the product's own fields rather than a related one. */
const IDENTITY_CONTAINERS = ["common", "product", "item", "node", "data"];

function toNumber(value: unknown): number | undefined {
	if (typeof value === "number")
		return Number.isFinite(value) && value > 0 ? value : undefined;
	if (typeof value !== "string") return undefined;
	const n = parseFloat(value.replace(/\s/g, "").replace(",", "."));
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

function str(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const t = value.trim();
	return t ? t : undefined;
}

function obj(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

interface ResolvedPrice {
	promoPrice: number;
	originalPrice?: number;
	discount?: string;
}

/**
 * A product's price is either the `price` key itself or an object hanging off
 * it. Anything else — `hasPrice: true`, a "halfPriceTitle" string — is not a
 * price and must not be read as one.
 */
export function resolvePrice(
	node: Record<string, unknown>,
): ResolvedPrice | undefined {
	const raw = node.price ?? node.mergedPrice;

	const flat = toNumber(raw);
	if (flat !== undefined) {
		return {
			promoPrice: flat,
			originalPrice:
				toNumber(node.oldPrice) ??
				toNumber(node.basePrice) ??
				toNumber(node.originalPrice),
			discount: str(node.discount) ?? str(node.discountDetail),
		};
	}

	const p = obj(raw);
	if (!p) return undefined;

	// Prices including tax are what a shopper is quoted, so they are the ones
	// the site advertises and the ones worth comparing across retailers.
	const promoPrice =
		toNumber(p.valueWithTax) ?? toNumber(p.value) ?? toNumber(p.amount);
	if (promoPrice === undefined) return undefined;

	// The discount label lives on the merged price even when the base price
	// object carries the same numbers, so read both.
	const options = obj(p.options) ?? {};
	const mergedOptions = obj(obj(node.mergedPrice)?.options) ?? {};
	const base = toNumber(p.baseValueWithTax) ?? toNumber(p.baseValue);

	return {
		promoPrice,
		// A base equal to the sale price is the shelf price, not a discount.
		originalPrice: base !== undefined && base > promoPrice ? base : undefined,
		discount:
			str(options.discountDetail) ??
			str(mergedOptions.discountDetail) ??
			str(p.discountDetail),
	};
}

interface Identity {
	product: string;
	key: string;
	category?: string;
	imageUrl?: string;
	affiliateUrl?: string;
}

function readIdentity(
	node: Record<string, unknown>,
	fallbackKey: string,
): Identity | undefined {
	const nameKey = NAME_KEYS.find((k) => str(node[k]));
	if (!nameKey) return undefined;

	const url = obj(node.URL);
	const visuals = Array.isArray(node.visuals) ? obj(node.visuals[0]) : undefined;

	return {
		product: str(node[nameKey])!,
		key: String(node.id ?? node.sku ?? node.productId ?? fallbackKey),
		category: str(node.category) ?? str(node.item_category),
		imageUrl: str(node.image) ?? str(node.imageUrl) ?? str(visuals?.listItem),
		affiliateUrl: str(node.url) ?? str(node.link) ?? str(url?.canonical),
	};
}

/** Identity from the priced node itself, else from a named container below it. */
function resolveIdentity(
	node: Record<string, unknown>,
	fallbackKey: string,
): Identity | undefined {
	const own = readIdentity(node, fallbackKey);
	if (own) return own;

	for (const container of IDENTITY_CONTAINERS) {
		const child = obj(node[container]);
		const nested = child && readIdentity(child, fallbackKey);
		if (nested) return nested;
	}
	return undefined;
}

export function dealsFromEmbeddedJson(
	blocks: string[],
	ctx: EmbeddedContext,
): Deal[] {
	const deals: Deal[] = [];
	const seen = new Set<string>();

	const visit = (node: unknown) => {
		if (Array.isArray(node)) {
			node.forEach(visit);
			return;
		}
		const record = obj(node);
		if (!record) return;

		const price = resolvePrice(record);
		if (price) {
			const id = resolveIdentity(record, `${price.promoPrice}`);
			if (id && !seen.has(id.key)) {
				seen.add(id.key);
				deals.push({
					id: `embedded-${ctx.retailerSlug}-${id.key}`,
					product: id.product,
					promoPrice: price.promoPrice,
					originalPrice: price.originalPrice,
					discount: price.discount,
					category: id.category,
					imageUrl: id.imageUrl,
					affiliateUrl: id.affiliateUrl,
					validFrom: ctx.validFrom,
					validUntil: ctx.validUntil,
					retailerSlug: ctx.retailerSlug,
				});
			}
		}

		for (const value of Object.values(record)) {
			if (value && typeof value === "object") visit(value);
		}
	};

	for (const block of blocks) {
		try {
			visit(JSON.parse(block));
		} catch {
			// Pages carry a lot of near-JSON; skipping one region is normal.
		}
	}

	return deals;
}

/**
 * Candidate JSON regions: arguments to `dataLayer.push(...)`, and any balanced
 * object literal that mentions a price key. Scanning for balance rather than
 * regex-matching to a closing tag matters because these payloads routinely
 * contain braces inside strings.
 */
export function embeddedJsonBlocks(html: string): string[] {
	const out: string[] = [];

	const push = /dataLayer\.push\(\s*(\{)/g;
	let m: RegExpExecArray | null;
	while ((m = push.exec(html)) !== null) {
		const block = balancedFrom(html, m.index + m[0].length - 1);
		if (block) out.push(block);
	}

	// Object literals introducing a price key. Anchor on the key rather than on
	// `{` alone, or every inline script in the document becomes a candidate.
	const priced = /"(?:price|mergedPrice)"\s*:/g;
	while ((m = priced.exec(html)) !== null) {
		const start = findEnclosingBrace(html, m.index);
		if (start === null) continue;
		const block = balancedFrom(html, start);
		if (block) out.push(block);
	}

	return out;
}

/** Walks back to the `{` that opens the object containing `index`. */
function findEnclosingBrace(html: string, index: number): number | null {
	let depth = 0;
	for (let i = index; i >= 0 && index - i < 400_000; i--) {
		const c = html[i];
		if (c === "}") depth++;
		else if (c === "{") {
			if (depth === 0) return i;
			depth--;
		}
	}
	return null;
}

/** Reads a balanced `{...}` starting at `start`, respecting strings. */
function balancedFrom(html: string, start: number): string | null {
	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let i = start; i < html.length && i - start < 400_000; i++) {
		const c = html[i];

		if (inString) {
			if (escaped) escaped = false;
			else if (c === "\\") escaped = true;
			else if (c === '"') inString = false;
			continue;
		}

		if (c === '"') inString = true;
		else if (c === "{") depth++;
		else if (c === "}") {
			depth--;
			if (depth === 0) return html.slice(start, i + 1);
		}
	}
	return null;
}
