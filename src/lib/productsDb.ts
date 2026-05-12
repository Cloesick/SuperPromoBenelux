import { neon } from "@neondatabase/serverless";
import { Deal, ContentSource } from "./types";

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

let cachedSql: ReturnType<typeof neon> | null = null;

function getSql() {
	if (cachedSql) return cachedSql;
	const conn = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
	if (!conn) return null;
	cachedSql = neon(conn);
	return cachedSql;
}

// ---------------------------------------------------------------------------
// Promo type inference
// ---------------------------------------------------------------------------

export function inferPromoType(deal: Deal): string {
	const label = (deal.discount ?? "").toLowerCase();
	const product = (deal.product ?? "").toLowerCase();
	const combined = `${label} ${product}`;

	// BOGO / multi-buy patterns (Dutch + French + English)
	if (
		/\b(1\+1|2\+1|3\+1|koop \d+ betaal|achetez \d+ payez|buy \d+ get)\b/i.test(
			combined,
		)
	) {
		return "bogo";
	}
	if (
		/\b(\d+\s*voor\s*€?\d|\d+\s*pour\s*€?\d|\d+\s*for\s*€?\d)/i.test(combined)
	) {
		return "multi_buy";
	}

	// Percentage off
	if (
		/-?\d+\s*%/.test(label) ||
		/korting.*%|%.*korting|réduction.*%/i.test(combined)
	) {
		return "percentage_off";
	}

	// Fixed euro discount
	if (/€\s*\d+.*korting|korting.*€\s*\d+|€\s*\d+.*réduction/i.test(combined)) {
		return "fixed_discount";
	}

	// Cashback
	if (/cashback|terugbetaald|remboursé/i.test(combined)) {
		return "cashback";
	}

	// Free gift
	if (/gratis.*cadeau|cadeau.*gratis|free.*gift|gratuit/i.test(combined)) {
		return "free_gift";
	}

	// Clearance / sale
	if (/opruiming|solden|uitverkoop|clearance|sale\b/i.test(combined)) {
		return "clearance";
	}

	// Has a promo price that differs from original → fixed price promo
	if (
		deal.promoPrice != null &&
		deal.originalPrice != null &&
		deal.promoPrice < deal.originalPrice
	) {
		return "fixed_price";
	}

	// Has any promo price at all
	if (deal.promoPrice != null) {
		return "fixed_price";
	}

	return "unknown";
}

// ---------------------------------------------------------------------------
// ISO week number helper
// ---------------------------------------------------------------------------

export function getIsoWeek(date: Date): number {
	const d = new Date(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
	);
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getIsoWeekYear(date: Date): number {
	const d = new Date(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
	);
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	return d.getUTCFullYear();
}

// ---------------------------------------------------------------------------
// Sync deals to database
// ---------------------------------------------------------------------------

export interface SyncOptions {
	retailerSlug: string;
	retailerName: string;
	vertical: string;
	deals: Deal[];
	scrapedAt: string;
	sourceMethod?: ContentSource;
	sourceUrl?: string;
	folderTitle?: string;
}

export async function syncDealsToDb(opts: SyncOptions): Promise<number> {
	const sql = getSql();
	if (!sql) return 0;

	const {
		deals,
		retailerSlug,
		retailerName,
		vertical,
		scrapedAt,
		sourceMethod,
		sourceUrl,
		folderTitle,
	} = opts;

	if (deals.length === 0) return 0;

	let synced = 0;

	for (const deal of deals) {
		try {
			const validFrom = deal.validFrom;
			const validUntil = deal.validUntil;
			const fromDate = new Date(validFrom);
			const weekNumber = getIsoWeek(fromDate);
			const year = getIsoWeekYear(fromDate);
			const promoType = inferPromoType(deal);

			await sql`
				INSERT INTO promo_products (
					retailer_slug, retailer_name, vertical,
					product_name, description, category, image_url, affiliate_url,
					original_price, promo_price, discount_label, promo_type,
					valid_from, valid_until, week_number, year,
					scraped_at, source_method, source_url, folder_title
				) VALUES (
					${retailerSlug}, ${retailerName}, ${vertical},
					${deal.product}, ${deal.description ?? null}, ${deal.category ?? null},
					${deal.imageUrl ?? null}, ${deal.affiliateUrl ?? null},
					${deal.originalPrice ?? null}, ${deal.promoPrice ?? null},
					${deal.discount ?? null}, ${promoType},
					${validFrom}, ${validUntil}, ${weekNumber}, ${year},
					${scrapedAt}, ${sourceMethod ?? null}, ${sourceUrl ?? null}, ${folderTitle ?? null}
				)
				ON CONFLICT (retailer_slug, product_name, COALESCE(promo_price, -1), valid_from, valid_until, vertical)
				DO UPDATE SET
					description     = EXCLUDED.description,
					category        = EXCLUDED.category,
					image_url       = EXCLUDED.image_url,
					original_price  = EXCLUDED.original_price,
					discount_label  = EXCLUDED.discount_label,
					promo_type      = EXCLUDED.promo_type,
					scraped_at      = EXCLUDED.scraped_at,
					source_method   = EXCLUDED.source_method,
					source_url      = EXCLUDED.source_url,
					folder_title    = EXCLUDED.folder_title
			`;
			synced++;
		} catch (err) {
			// Log but don't fail the entire sync for one bad row
			console.error(
				`[productsDb] Failed to sync deal "${deal.product}" for ${retailerSlug}:`,
				err,
			);
		}
	}

	return synced;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export interface PromoProduct {
	id: string;
	retailer_slug: string;
	retailer_name: string;
	vertical: string;
	product_name: string;
	description: string | null;
	category: string | null;
	image_url: string | null;
	original_price: number | null;
	promo_price: number | null;
	discount_label: string | null;
	promo_type: string | null;
	valid_from: string;
	valid_until: string;
	week_number: number;
	year: number;
	scraped_at: string;
	source_method: string | null;
}

export async function getProductsByRetailer(
	retailerSlug: string,
	opts?: { limit?: number; weekNumber?: number; year?: number },
): Promise<PromoProduct[]> {
	const sql = getSql();
	if (!sql) return [];

	const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 5000);

	try {
		if (opts?.weekNumber && opts?.year) {
			const result = await sql`
				SELECT * FROM promo_products
				WHERE retailer_slug = ${retailerSlug}
				  AND week_number = ${opts.weekNumber}
				  AND year = ${opts.year}
				ORDER BY product_name ASC
				LIMIT ${limit}
			`;
			return (result ?? []) as unknown as PromoProduct[];
		}

		const result = await sql`
			SELECT * FROM promo_products
			WHERE retailer_slug = ${retailerSlug}
			ORDER BY scraped_at DESC, product_name ASC
			LIMIT ${limit}
		`;
		return (result ?? []) as unknown as PromoProduct[];
	} catch {
		return [];
	}
}

export async function getProductsByWeek(
	weekNumber: number,
	year: number,
	opts?: { vertical?: string; limit?: number },
): Promise<PromoProduct[]> {
	const sql = getSql();
	if (!sql) return [];

	const limit = Math.min(Math.max(opts?.limit ?? 1000, 1), 10000);

	try {
		if (opts?.vertical) {
			const result = await sql`
				SELECT * FROM promo_products
				WHERE week_number = ${weekNumber}
				  AND year = ${year}
				  AND vertical = ${opts.vertical}
				ORDER BY retailer_slug ASC, product_name ASC
				LIMIT ${limit}
			`;
			return (result ?? []) as unknown as PromoProduct[];
		}

		const result = await sql`
			SELECT * FROM promo_products
			WHERE week_number = ${weekNumber}
			  AND year = ${year}
			ORDER BY retailer_slug ASC, product_name ASC
			LIMIT ${limit}
		`;
		return (result ?? []) as unknown as PromoProduct[];
	} catch {
		return [];
	}
}

export async function getProductsByCategory(
	category: string,
	opts?: { limit?: number; days?: number },
): Promise<PromoProduct[]> {
	const sql = getSql();
	if (!sql) return [];

	const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 5000);
	const days = Math.min(Math.max(opts?.days ?? 30, 1), 365);
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

	try {
		const result = await sql`
			SELECT * FROM promo_products
			WHERE LOWER(category) = LOWER(${category})
			  AND scraped_at >= ${since}
			ORDER BY promo_price ASC NULLS LAST, product_name ASC
			LIMIT ${limit}
		`;
		return (result ?? []) as unknown as PromoProduct[];
	} catch {
		return [];
	}
}

export async function getProductStats(opts?: { days?: number }): Promise<{
	total: number;
	retailers: number;
	categories: number;
	latestScrape: string | null;
}> {
	const sql = getSql();
	if (!sql)
		return { total: 0, retailers: 0, categories: 0, latestScrape: null };

	const days = Math.min(Math.max(opts?.days ?? 30, 1), 365);
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

	try {
		const result = await sql`
			SELECT
				COUNT(*)::int AS total,
				COUNT(DISTINCT retailer_slug)::int AS retailers,
				COUNT(DISTINCT category)::int AS categories,
				MAX(scraped_at)::text AS latest_scrape
			FROM promo_products
			WHERE scraped_at >= ${since}
		`;
		const row = ((result as unknown[])?.[0] ?? {}) as Record<string, unknown>;
		return {
			total: (row.total as number) ?? 0,
			retailers: (row.retailers as number) ?? 0,
			categories: (row.categories as number) ?? 0,
			latestScrape: (row.latest_scrape as string) ?? null,
		};
	} catch {
		return { total: 0, retailers: 0, categories: 0, latestScrape: null };
	}
}

export async function searchProducts(
	query: string,
	opts?: { limit?: number; vertical?: string },
): Promise<PromoProduct[]> {
	const sql = getSql();
	if (!sql) return [];

	const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 1000);
	const pattern = `%${query}%`;

	try {
		if (opts?.vertical) {
			const result = await sql`
				SELECT * FROM promo_products
				WHERE (product_name ILIKE ${pattern} OR description ILIKE ${pattern})
				  AND vertical = ${opts.vertical}
				  AND valid_until >= CURRENT_DATE
				ORDER BY promo_price ASC NULLS LAST
				LIMIT ${limit}
			`;
			return (result ?? []) as unknown as PromoProduct[];
		}

		const result = await sql`
			SELECT * FROM promo_products
			WHERE (product_name ILIKE ${pattern} OR description ILIKE ${pattern})
			  AND valid_until >= CURRENT_DATE
			ORDER BY promo_price ASC NULLS LAST
			LIMIT ${limit}
		`;
		return (result ?? []) as unknown as PromoProduct[];
	} catch {
		return [];
	}
}
