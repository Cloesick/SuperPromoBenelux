-- Promo products database
-- Stores deal/product data extracted from retailer folders and promo pages
-- Designed for historical tracking, analytics, and price comparison

CREATE TABLE IF NOT EXISTS promo_products (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Retailer & vertical
  retailer_slug   TEXT        NOT NULL,
  retailer_name   TEXT        NOT NULL,
  vertical        TEXT        NOT NULL DEFAULT 'general',
    -- vertical values: general, pet, electro, fashion, home-garden, beauty, diy

  -- Product info
  product_name    TEXT        NOT NULL,
  description     TEXT,
  category        TEXT,
  image_url       TEXT,
  affiliate_url   TEXT,

  -- Pricing
  original_price  NUMERIC(10,2),
  promo_price     NUMERIC(10,2),
  discount_label  TEXT,
    -- e.g. "-30%", "2+1 gratis", "€2 korting"
  promo_type      TEXT,
    -- Inferred: percentage_off, fixed_price, bogo, multi_buy, cashback, free_gift, clearance, unknown

  -- Validity period
  valid_from      DATE        NOT NULL,
  valid_until     DATE        NOT NULL,
  week_number     INT         NOT NULL,
  year            INT         NOT NULL,

  -- Scrape metadata
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_method   TEXT,
    -- html, json-ld, api, screenshot
  source_url      TEXT,
  folder_title    TEXT,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate products in the same promo period
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_products_unique
  ON promo_products (retailer_slug, product_name, COALESCE(promo_price, -1), valid_from, valid_until, vertical);

-- Fast lookups
CREATE INDEX IF NOT EXISTS idx_promo_products_retailer     ON promo_products (retailer_slug);
CREATE INDEX IF NOT EXISTS idx_promo_products_vertical     ON promo_products (vertical);
CREATE INDEX IF NOT EXISTS idx_promo_products_week         ON promo_products (year, week_number);
CREATE INDEX IF NOT EXISTS idx_promo_products_valid        ON promo_products (valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_promo_products_category     ON promo_products (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promo_products_promo_type   ON promo_products (promo_type) WHERE promo_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promo_products_scraped      ON promo_products (scraped_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_promo_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promo_products_updated_at ON promo_products;
CREATE TRIGGER trg_promo_products_updated_at
  BEFORE UPDATE ON promo_products
  FOR EACH ROW
  EXECUTE FUNCTION update_promo_products_updated_at();
