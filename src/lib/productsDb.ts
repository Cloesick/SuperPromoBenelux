import Database from "better-sqlite3";
import path from "path";
import { Deal, ContentSource } from "./types";

// ---------------------------------------------------------------------------
// Connection (SQLite)
// ---------------------------------------------------------------------------

const DB_PATH = path.join(process.cwd(), "data", "products.db");

let cachedDb: Database.Database | null = null;

function getDb(): Database.Database {
	if (cachedDb) return cachedDb;
	cachedDb = new Database(DB_PATH);
	cachedDb.pragma("journal_mode = WAL");
	cachedDb.pragma("busy_timeout = 5000");
	initSchema(cachedDb);
	return cachedDb;
}

function initSchema(db: Database.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS promo_products (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			retailer_slug TEXT NOT NULL,
			retailer_name TEXT NOT NULL,
			vertical TEXT NOT NULL DEFAULT 'general',
			product_name TEXT NOT NULL,
			description TEXT,
			category TEXT,
			image_url TEXT,
			affiliate_url TEXT,
			original_price REAL,
			promo_price REAL,
			discount_label TEXT,
			promo_type TEXT,
			valid_from TEXT NOT NULL,
			valid_until TEXT NOT NULL,
			week_number INTEGER NOT NULL,
			year INTEGER NOT NULL,
			scraped_at TEXT NOT NULL,
			source_method TEXT,
			source_url TEXT,
			folder_title TEXT,
			created_at TEXT DEFAULT (datetime('now'))
		);

		CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_unique
			ON promo_products (retailer_slug, product_name, COALESCE(promo_price, -1), valid_from, valid_until, vertical);

		CREATE INDEX IF NOT EXISTS idx_promo_retailer ON promo_products (retailer_slug);
		CREATE INDEX IF NOT EXISTS idx_promo_week ON promo_products (week_number, year);
		CREATE INDEX IF NOT EXISTS idx_promo_vertical ON promo_products (vertical);
		CREATE INDEX IF NOT EXISTS idx_promo_category ON promo_products (category);
		CREATE INDEX IF NOT EXISTS idx_promo_valid_until ON promo_products (valid_until);
	`);
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

export function syncDealsToDb(opts: SyncOptions): number {
	const db = getDb();

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

	const stmt = db.prepare(`
		INSERT INTO promo_products (
			retailer_slug, retailer_name, vertical,
			product_name, description, category, image_url, affiliate_url,
			original_price, promo_price, discount_label, promo_type,
			valid_from, valid_until, week_number, year,
			scraped_at, source_method, source_url, folder_title
		) VALUES (
			@retailerSlug, @retailerName, @vertical,
			@productName, @description, @category, @imageUrl, @affiliateUrl,
			@originalPrice, @promoPrice, @discountLabel, @promoType,
			@validFrom, @validUntil, @weekNumber, @year,
			@scrapedAt, @sourceMethod, @sourceUrl, @folderTitle
		)
		ON CONFLICT (retailer_slug, product_name, COALESCE(promo_price, -1), valid_from, valid_until, vertical)
		DO UPDATE SET
			description     = excluded.description,
			category        = excluded.category,
			image_url       = excluded.image_url,
			original_price  = excluded.original_price,
			discount_label  = excluded.discount_label,
			promo_type      = excluded.promo_type,
			scraped_at      = excluded.scraped_at,
			source_method   = excluded.source_method,
			source_url      = excluded.source_url,
			folder_title    = excluded.folder_title
	`);

	let synced = 0;

	const insertMany = db.transaction((items: Deal[]) => {
		for (const deal of items) {
			try {
				const validFrom = deal.validFrom;
				const validUntil = deal.validUntil;
				const fromDate = new Date(validFrom);
				const weekNumber = getIsoWeek(fromDate);
				const year = getIsoWeekYear(fromDate);
				const promoType = inferPromoType(deal);

				stmt.run({
					retailerSlug,
					retailerName,
					vertical,
					productName: deal.product,
					description: deal.description ?? null,
					category: deal.category ?? null,
					imageUrl: deal.imageUrl ?? null,
					affiliateUrl: deal.affiliateUrl ?? null,
					originalPrice: deal.originalPrice ?? null,
					promoPrice: deal.promoPrice ?? null,
					discountLabel: deal.discount ?? null,
					promoType,
					validFrom,
					validUntil,
					weekNumber,
					year,
					scrapedAt,
					sourceMethod: sourceMethod ?? null,
					sourceUrl: sourceUrl ?? null,
					folderTitle: folderTitle ?? null,
				});
				synced++;
			} catch (err) {
				console.error(
					`[productsDb] Failed to sync deal "${deal.product}" for ${retailerSlug}:`,
					err,
				);
			}
		}
	});

	insertMany(deals);
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

export function getProductsByRetailer(
	retailerSlug: string,
	opts?: { limit?: number; weekNumber?: number; year?: number },
): PromoProduct[] {
	const db = getDb();
	const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 5000);

	try {
		if (opts?.weekNumber && opts?.year) {
			return db
				.prepare(
					`SELECT * FROM promo_products
					 WHERE retailer_slug = ? AND week_number = ? AND year = ?
					 ORDER BY product_name ASC LIMIT ?`,
				)
				.all(retailerSlug, opts.weekNumber, opts.year, limit) as PromoProduct[];
		}

		return db
			.prepare(
				`SELECT * FROM promo_products
				 WHERE retailer_slug = ?
				 ORDER BY scraped_at DESC, product_name ASC LIMIT ?`,
			)
			.all(retailerSlug, limit) as PromoProduct[];
	} catch {
		return [];
	}
}

export function getProductsByWeek(
	weekNumber: number,
	year: number,
	opts?: { vertical?: string; limit?: number },
): PromoProduct[] {
	const db = getDb();
	const limit = Math.min(Math.max(opts?.limit ?? 1000, 1), 10000);

	try {
		if (opts?.vertical) {
			return db
				.prepare(
					`SELECT * FROM promo_products
					 WHERE week_number = ? AND year = ? AND vertical = ?
					 ORDER BY retailer_slug ASC, product_name ASC LIMIT ?`,
				)
				.all(weekNumber, year, opts.vertical, limit) as PromoProduct[];
		}

		return db
			.prepare(
				`SELECT * FROM promo_products
				 WHERE week_number = ? AND year = ?
				 ORDER BY retailer_slug ASC, product_name ASC LIMIT ?`,
			)
			.all(weekNumber, year, limit) as PromoProduct[];
	} catch {
		return [];
	}
}

export function getProductsByCategory(
	category: string,
	opts?: { limit?: number; days?: number },
): PromoProduct[] {
	const db = getDb();
	const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 5000);
	const days = Math.min(Math.max(opts?.days ?? 30, 1), 365);
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

	try {
		return db
			.prepare(
				`SELECT * FROM promo_products
				 WHERE category = ? COLLATE NOCASE AND scraped_at >= ?
				 ORDER BY promo_price ASC, product_name ASC LIMIT ?`,
			)
			.all(category, since, limit) as PromoProduct[];
	} catch {
		return [];
	}
}

export function getProductStats(opts?: { days?: number }): {
	total: number;
	retailers: number;
	categories: number;
	latestScrape: string | null;
} {
	const db = getDb();
	const days = Math.min(Math.max(opts?.days ?? 30, 1), 365);
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

	try {
		const row = db
			.prepare(
				`SELECT
					COUNT(*) AS total,
					COUNT(DISTINCT retailer_slug) AS retailers,
					COUNT(DISTINCT category) AS categories,
					MAX(scraped_at) AS latest_scrape
				 FROM promo_products
				 WHERE scraped_at >= ?`,
			)
			.get(since) as Record<string, unknown> | undefined;

		return {
			total: (row?.total as number) ?? 0,
			retailers: (row?.retailers as number) ?? 0,
			categories: (row?.categories as number) ?? 0,
			latestScrape: (row?.latest_scrape as string) ?? null,
		};
	} catch {
		return { total: 0, retailers: 0, categories: 0, latestScrape: null };
	}
}

export function searchProducts(
	query: string,
	opts?: { limit?: number; vertical?: string },
): PromoProduct[] {
	const db = getDb();
	const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 1000);
	const pattern = `%${query}%`;
	const today = new Date().toISOString().slice(0, 10);

	try {
		if (opts?.vertical) {
			return db
				.prepare(
					`SELECT * FROM promo_products
					 WHERE (product_name LIKE ? OR description LIKE ?)
					   AND vertical = ? AND valid_until >= ?
					 ORDER BY promo_price ASC LIMIT ?`,
				)
				.all(pattern, pattern, opts.vertical, today, limit) as PromoProduct[];
		}

		return db
			.prepare(
				`SELECT * FROM promo_products
				 WHERE (product_name LIKE ? OR description LIKE ?)
				   AND valid_until >= ?
				 ORDER BY promo_price ASC LIMIT ?`,
			)
			.all(pattern, pattern, today, limit) as PromoProduct[];
	} catch {
		return [];
	}
}
