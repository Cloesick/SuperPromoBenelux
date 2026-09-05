// ---------------------------------------------------------------------------
// Products out of schema.org JSON-LD.
//
// The previous version of this ran entirely inside `page.evaluate` and only
// looked at top-level entries: `Array.isArray(data) ? data : [data]`. That
// misses the two shapes retailers most often ship —
//
//   { "@graph": [ … ] }          a single wrapper around everything
//   { "@type": ["Product", …] }  a type list rather than a bare string
//
// — so a page could advertise 22 products and yield none. Parsing happens here,
// in Node, rather than in the browser: the same code then serves both a live
// page and a fetched HTML string, and it is unit-testable without a browser.
// ---------------------------------------------------------------------------

import { Deal } from "../lib/types";
import { normalizeSchemaImage } from "../lib/schemaImage";

export interface JsonLdContext {
	retailerSlug: string;
	validFrom: string;
	validUntil: string;
}

/** schema.org values arrive as string | number | null; only finite numbers count. */
function toPrice(value: unknown): number | undefined {
	if (value == null) return undefined;
	// Prices cross the wire as "12,99" as often as "12.99".
	const n =
		typeof value === "number"
			? value
			: parseFloat(String(value).replace(",", "."));
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

function typesOf(node: Record<string, unknown>): string[] {
	const t = node["@type"];
	if (typeof t === "string") return [t];
	if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
	return [];
}

/** The offer carrying the price may be the node itself, an object, or a list. */
function offersOf(node: Record<string, unknown>): Record<string, unknown>[] {
	const raw = node.offers;
	if (!raw) return [node];
	const list = Array.isArray(raw) ? raw : [raw];
	const objs = list.filter(
		(o): o is Record<string, unknown> => !!o && typeof o === "object",
	);
	return objs.length > 0 ? objs : [node];
}

/**
 * Walks every nested object, so `@graph`, `ItemList.itemListElement` and
 * arbitrarily nested `item` wrappers are all reached by the same pass rather
 * than each needing its own special case.
 */
export function dealsFromJsonLd(blocks: string[], ctx: JsonLdContext): Deal[] {
	const deals: Deal[] = [];
	const seen = new Set<string>();

	const visit = (node: unknown) => {
		if (Array.isArray(node)) {
			node.forEach(visit);
			return;
		}
		if (!node || typeof node !== "object") return;
		const obj = node as Record<string, unknown>;

		if (typesOf(obj).some((t) => t === "Product" || t === "Offer")) {
			const name = typeof obj.name === "string" ? obj.name.trim() : "";
			if (name) {
				for (const offer of offersOf(obj)) {
					const promoPrice = toPrice(offer.price ?? offer.lowPrice);
					const originalPrice = toPrice(offer.highPrice);

					// Two different offers on one product are two rows; the same offer
					// reached twice through nesting is one. Key on what identifies it.
					const key = `${name}|${promoPrice ?? ""}|${originalPrice ?? ""}`;
					if (seen.has(key)) continue;
					seen.add(key);

					deals.push({
						id: `jsonld-${deals.length}`,
						product: name,
						promoPrice,
						originalPrice,
						description:
							typeof obj.description === "string" ? obj.description : undefined,
						imageUrl: normalizeSchemaImage(obj.image),
						validFrom: ctx.validFrom,
						validUntil: ctx.validUntil,
						retailerSlug: ctx.retailerSlug,
					});
				}
			}
		}

		// Keep walking regardless: a Product can contain an ItemList of variants,
		// and @graph siblings are only reachable by continuing past the match.
		for (const value of Object.values(obj)) {
			if (value && typeof value === "object") visit(value);
		}
	};

	for (const block of blocks) {
		try {
			visit(JSON.parse(block));
		} catch {
			// A single malformed block must not discard the rest of the page.
		}
	}

	return deals;
}

/** Pulls the raw <script type="application/ld+json"> bodies out of HTML. */
export function jsonLdBlocks(html: string): string[] {
	const out: string[] = [];
	const re =
		/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html)) !== null) out.push(m[1]);
	return out;
}
