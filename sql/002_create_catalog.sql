-- Canonical products are the identity layer: one row per real-world product,
-- regardless of how many retailers sell it or how each one spells it. Without
-- this, "Coca-Cola 1,5 L" at Delhaize and "Coca Cola PET 1.5l" at Colruyt are
-- two unrelated strings and no comparison is possible.
CREATE TABLE IF NOT EXISTS canonical_products (
  id            TEXT PRIMARY KEY,
  -- normalized brand|size|multipack, from src/lib/productIdentity.ts
  canonical_key TEXT NOT NULL UNIQUE,
  brand         TEXT,
  name          TEXT NOT NULL,
  variant       TEXT,
  size_value    INTEGER,
  size_unit     TEXT,
  multipack     INTEGER NOT NULL DEFAULT 1,
  category      TEXT,
  slug          TEXT NOT NULL UNIQUE,
  -- pending entries still accumulate offers, so approving one later backfills
  -- its history instead of starting it from zero.
  review_status TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prices are integer eurocents. Float money silently rounds, and a price wrong
-- by a cent is a trust problem on a site whose whole value is price accuracy.
CREATE TABLE IF NOT EXISTS product_offers (
  id                   BIGSERIAL PRIMARY KEY,
  canonical_id         TEXT NOT NULL REFERENCES canonical_products(id) ON DELETE CASCADE,
  retailer_slug        TEXT NOT NULL,
  price_cents          INTEGER NOT NULL,
  original_price_cents INTEGER,
  -- "2+1 gratis" has no single comparable unit price, so the label is kept
  -- verbatim rather than flattened into a misleading per-unit figure.
  promo_type           TEXT,
  promo_label          TEXT,
  valid_from           DATE NOT NULL,
  valid_until          DATE NOT NULL,
  folder_id            TEXT,
  source_page          INTEGER,
  confidence           REAL NOT NULL,
  scraped_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (canonical_id, retailer_slug, valid_from, valid_until)
);

CREATE INDEX IF NOT EXISTS idx_offers_canonical ON product_offers (canonical_id);
CREATE INDEX IF NOT EXISTS idx_offers_validity  ON product_offers (valid_until);
CREATE INDEX IF NOT EXISTS idx_canonical_status ON canonical_products (review_status);
