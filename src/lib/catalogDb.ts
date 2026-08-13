import { neon } from "@neondatabase/serverless";
import type { ParsedSize } from "./productIdentity";

let cachedSql: ReturnType<typeof neon> | null = null;

function getSql() {
  if (cachedSql) return cachedSql;
  const conn = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!conn) return null;
  cachedSql = neon(conn);
  return cachedSql;
}

export interface CanonicalProduct {
  id: string;
  canonical_key: string;
  brand: string | null;
  name: string;
  variant: string | null;
  slug: string;
  review_status: "pending" | "approved" | "rejected";
}

export interface NewCanonical {
  canonicalKey: string;
  brand: string | null;
  name: string;
  variant: string | null;
  size: ParsedSize | null;
  category: string | null;
  slug: string;
}

export interface NewOffer {
  canonicalId: string;
  retailerSlug: string;
  priceCents: number;
  originalPriceCents: number | null;
  promoType: string | null;
  promoLabel: string | null;
  validFrom: string;
  validUntil: string;
  folderId: string | null;
  sourcePage: number | null;
  confidence: number;
}

export interface ComparableProduct {
  id: string;
  slug: string;
  brand: string | null;
  name: string;
  variant: string | null;
  retailer_count: number;
}

export interface ProductOfferRow {
  retailer_slug: string;
  price_cents: number;
  original_price_cents: number | null;
  promo_label: string | null;
  valid_until: string;
  folder_id: string | null;
}

export async function findCanonicalByKey(
  key: string,
): Promise<CanonicalProduct | null> {
  const sql = getSql();
  if (!sql) return null;
  const rows = (await sql`
    SELECT id, canonical_key, brand, name, variant, slug, review_status
    FROM canonical_products
    WHERE canonical_key = ${key}
    LIMIT 1
  `) as CanonicalProduct[];
  return rows[0] ?? null;
}

export async function insertCanonical(input: NewCanonical): Promise<string> {
  const sql = getSql();
  if (!sql) throw new Error("No database connection configured");

  const id = crypto.randomUUID();
  await sql`
    INSERT INTO canonical_products (
      id, canonical_key, brand, name, variant,
      size_value, size_unit, multipack, category, slug
    ) VALUES (
      ${id}, ${input.canonicalKey}, ${input.brand}, ${input.name}, ${input.variant},
      ${input.size?.value ?? null}, ${input.size?.unit ?? null},
      ${input.size?.multipack ?? 1}, ${input.category}, ${input.slug}
    )
    ON CONFLICT (canonical_key) DO NOTHING
  `;

  // A concurrent writer may have won the insert, so read back rather than
  // trusting the id we generated.
  const existing = await findCanonicalByKey(input.canonicalKey);
  return existing?.id ?? id;
}

export async function upsertOffer(input: NewOffer): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  await sql`
    INSERT INTO product_offers (
      canonical_id, retailer_slug, price_cents, original_price_cents,
      promo_type, promo_label, valid_from, valid_until,
      folder_id, source_page, confidence
    ) VALUES (
      ${input.canonicalId}, ${input.retailerSlug}, ${input.priceCents},
      ${input.originalPriceCents}, ${input.promoType}, ${input.promoLabel},
      ${input.validFrom}, ${input.validUntil},
      ${input.folderId}, ${input.sourcePage}, ${input.confidence}
    )
    ON CONFLICT (canonical_id, retailer_slug, valid_from, valid_until)
    DO UPDATE SET
      price_cents          = EXCLUDED.price_cents,
      original_price_cents = EXCLUDED.original_price_cents,
      promo_type           = EXCLUDED.promo_type,
      promo_label          = EXCLUDED.promo_label,
      confidence           = EXCLUDED.confidence,
      scraped_at           = now()
  `;
}

/**
 * Only products a shopper can actually compare: approved, currently valid, and
 * carrying offers from at least two distinct retailers. A single-price page is
 * not a comparison, it is a thin page — the same rule isFolderIndexable applies
 * to folders.
 */
export async function getComparableProducts(): Promise<ComparableProduct[]> {
  const sql = getSql();
  if (!sql) return [];
  return (await sql`
    SELECT c.id, c.slug, c.brand, c.name, c.variant,
           COUNT(DISTINCT o.retailer_slug)::int AS retailer_count
    FROM canonical_products c
    JOIN product_offers o ON o.canonical_id = c.id
    WHERE c.review_status = 'approved'
      AND o.valid_until >= CURRENT_DATE
    GROUP BY c.id, c.slug, c.brand, c.name, c.variant
    HAVING COUNT(DISTINCT o.retailer_slug) >= 2
    ORDER BY retailer_count DESC, c.name ASC
  `) as ComparableProduct[];
}

export async function getProductBySlug(slug: string): Promise<{
  product: ComparableProduct;
  offers: ProductOfferRow[];
} | null> {
  const sql = getSql();
  if (!sql) return null;

  const products = (await sql`
    SELECT c.id, c.slug, c.brand, c.name, c.variant,
           COUNT(DISTINCT o.retailer_slug)::int AS retailer_count
    FROM canonical_products c
    JOIN product_offers o ON o.canonical_id = c.id
    WHERE c.slug = ${slug}
      AND c.review_status = 'approved'
      AND o.valid_until >= CURRENT_DATE
    GROUP BY c.id, c.slug, c.brand, c.name, c.variant
    HAVING COUNT(DISTINCT o.retailer_slug) >= 2
  `) as ComparableProduct[];

  const product = products[0];
  if (!product) return null;

  const offers = (await sql`
    SELECT retailer_slug, price_cents, original_price_cents,
           promo_label, valid_until, folder_id
    FROM product_offers
    WHERE canonical_id = ${product.id}
      AND valid_until >= CURRENT_DATE
    ORDER BY price_cents ASC
  `) as ProductOfferRow[];

  return { product, offers };
}
