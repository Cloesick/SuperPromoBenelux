# Cross-Retailer Price Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract clean, priced products from supermarket leaflet page images and publish per-product pages answering "where is this cheapest this week?".

**Architecture:** A four-stage pipeline. Leaflet page images (already captured, stored on `FolderPage.imageUrl`) go to Claude Sonnet 5 via the Batch API with a JSON schema, producing structured products. Each product is resolved against a canonical catalog — a deterministic `brand+size+unit` key first, a model call only on a miss. Offers are stored per retailer with validity dates, and products carrying offers from two or more retailers get a statically generated comparison page.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Neon Postgres (`@neondatabase/serverless`), `@anthropic-ai/sdk`, Vitest 4.

## Global Constraints

- Scope is six grocery chains only: `albert-heijn`, `aldi`, `colruyt`, `delhaize`, `lidl`, `spar`. Never extend extraction to other retailer slugs.
- Model ID is exactly `claude-sonnet-5`. Never append a date suffix.
- All extraction runs through the Batch API (`client.messages.batches.create`). Never call `messages.create` per page for production extraction.
- Never set `temperature`, `top_p`, `top_k`, or `thinking.budget_tokens` — all are rejected on Sonnet 5.
- Prices are stored in **euro cents as integers**, never floats. `€4.49` is `449`.
- A canonical product is only publishable with offers from **two or more distinct retailers**.
- Comments explain *why*, not *what*. Match the surrounding file's tab indentation (`src/lib/*.ts` uses 2 spaces, `src/components/*.tsx` and `src/scrapers/*.ts` use tabs).
- All user-facing copy is Dutch (nl-BE).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/productIdentity.ts` | Pure normalization: brand, size parsing, canonical key. No I/O. |
| `src/lib/productIdentity.test.ts` | Tests for the above. |
| `src/scrapers/productExtraction.ts` | Extraction JSON schema + prompt builder. No network. |
| `src/scrapers/productExtraction.test.ts` | Tests for schema/prompt. |
| `src/scrapers/extractProductsFromImages.ts` | Anthropic Batch API client. Network only. |
| `sql/002_create_catalog.sql` | Migration for `canonical_products` + `product_offers`. |
| `src/lib/catalogDb.ts` | All catalog/offer SQL. |
| `src/lib/canonicalize.ts` | Resolve an extracted product to a canonical id. |
| `src/lib/canonicalize.test.ts` | Tests for resolution logic. |
| `src/app/prijzen/[product]/page.tsx` | Per-product comparison page. |
| `src/app/sitemap.ts` | Modified: add `/prijzen/*` entries. |

Extraction and identity are split because identity logic is pure and heavily tested, while extraction is network-bound and mocked. They change for different reasons.

---

### Task 1: Size and brand normalization

The matching layer stands entirely on this. `"1,5 L"`, `"1.5l"`, and `"6 x 25 cl"` must all reduce to comparable numbers or nothing downstream can match.

**Files:**
- Create: `src/lib/productIdentity.ts`
- Test: `src/lib/productIdentity.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseSize(raw: string): ParsedSize | null` where `ParsedSize = { value: number; unit: "ml" | "g" | "piece"; multipack: number }`; `normalizeBrand(raw: string): string`; `canonicalKey(brand: string, size: ParsedSize | null): string`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/productIdentity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canonicalKey, normalizeBrand, parseSize } from "./productIdentity";

// ---------------------------------------------------------------------------
// Belgian leaflets write sizes in Dutch/French conventions: comma decimals,
// multipacks as "6 x 33 cl", and units that mix metric scales. Everything must
// reduce to one base unit per dimension or cross-retailer matching is guesswork.
// ---------------------------------------------------------------------------

describe("parseSize", () => {
  it("converts litres to millilitres with a comma decimal", () => {
    expect(parseSize("1,5 L")).toEqual({ value: 1500, unit: "ml", multipack: 1 });
  });

  it("accepts a dot decimal and no space", () => {
    expect(parseSize("1.5l")).toEqual({ value: 1500, unit: "ml", multipack: 1 });
  });

  it("converts centilitres", () => {
    expect(parseSize("33 cl")).toEqual({ value: 330, unit: "ml", multipack: 1 });
  });

  it("converts kilograms to grams", () => {
    expect(parseSize("1 kg")).toEqual({ value: 1000, unit: "g", multipack: 1 });
  });

  it("keeps grams as grams", () => {
    expect(parseSize("500g")).toEqual({ value: 500, unit: "g", multipack: 1 });
  });

  it("expands a multipack to its total volume and records the count", () => {
    // 6 x 33 cl is 1980 ml total. Storing both lets us compare a six-pack
    // against a six-pack rather than against a single bottle.
    expect(parseSize("6 x 33 cl")).toEqual({ value: 1980, unit: "ml", multipack: 6 });
  });

  it("handles a multipack written without spaces", () => {
    expect(parseSize("4x125g")).toEqual({ value: 500, unit: "g", multipack: 4 });
  });

  it("treats a bare count as pieces", () => {
    expect(parseSize("10 stuks")).toEqual({ value: 10, unit: "piece", multipack: 1 });
  });

  it("returns null when there is no size to parse", () => {
    expect(parseSize("")).toBeNull();
    expect(parseSize("per stuk")).toBeNull();
  });
});

describe("normalizeBrand", () => {
  it("lowercases and strips punctuation and spacing", () => {
    expect(normalizeBrand("Coca-Cola")).toBe("cocacola");
    expect(normalizeBrand("Coca Cola")).toBe("cocacola");
    expect(normalizeBrand("COCA-COLA®")).toBe("cocacola");
  });

  it("strips accents so Dutch and French spellings converge", () => {
    expect(normalizeBrand("Café Liégeois")).toBe("cafeliegeois");
  });
});

describe("canonicalKey", () => {
  it("joins normalized brand with the reduced size", () => {
    expect(canonicalKey("Coca-Cola", parseSize("1,5 L"))).toBe("cocacola|1500ml|1");
  });

  it("distinguishes a multipack from the same total volume sold singly", () => {
    // 6x33cl and a single 1980ml bottle are not the same product to a shopper.
    expect(canonicalKey("Jupiler", parseSize("6 x 33 cl"))).not.toBe(
      canonicalKey("Jupiler", parseSize("1980 ml")),
    );
  });

  it("marks an unknown size rather than colliding every sizeless product", () => {
    expect(canonicalKey("Boni", null)).toBe("boni|nosize|1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -c vitest.config.ts src/lib/productIdentity.test.ts`
Expected: FAIL — `Failed to resolve import "./productIdentity"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/productIdentity.ts`:

```ts
export type SizeUnit = "ml" | "g" | "piece";

export interface ParsedSize {
  value: number;
  unit: SizeUnit;
  multipack: number;
}

/* Factors reduce every written unit to one base per dimension: volume to
 * millilitres, weight to grams. Comparing "1,5 L" against "150 cl" is only
 * possible once both are integers in the same unit. */
const UNIT_FACTORS: Record<string, { unit: SizeUnit; factor: number }> = {
  l: { unit: "ml", factor: 1000 },
  liter: { unit: "ml", factor: 1000 },
  cl: { unit: "ml", factor: 10 },
  ml: { unit: "ml", factor: 1 },
  kg: { unit: "g", factor: 1000 },
  g: { unit: "g", factor: 1 },
  gr: { unit: "g", factor: 1 },
  stuks: { unit: "piece", factor: 1 },
  stuk: { unit: "piece", factor: 1 },
  st: { unit: "piece", factor: 1 },
};

const UNIT_PATTERN = Object.keys(UNIT_FACTORS)
  .sort((a, b) => b.length - a.length) // longest first so "cl" beats "l"
  .join("|");

export function parseSize(raw: string | null | undefined): ParsedSize | null {
  if (!raw) return null;

  const text = raw.toLowerCase().replace(/,/g, ".").trim();

  const multi = new RegExp(
    `(\\d+)\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\b`,
  ).exec(text);
  if (multi) {
    const count = Number(multi[1]);
    const each = Number(multi[2]);
    const spec = UNIT_FACTORS[multi[3]];
    return {
      value: Math.round(count * each * spec.factor),
      unit: spec.unit,
      multipack: count,
    };
  }

  const single = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\b`,
  ).exec(text);
  if (single) {
    const spec = UNIT_FACTORS[single[2]];
    return {
      value: Math.round(Number(single[1]) * spec.factor),
      unit: spec.unit,
      multipack: 1,
    };
  }

  return null;
}

export function normalizeBrand(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents: Liégeois -> Liegeois
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * The lookup key for the deterministic matching tier. Multipack is part of the
 * key because a six-pack and a single bottle of the same total volume are
 * different products on a shelf, and pricing them against each other is wrong.
 */
export function canonicalKey(
  brand: string | null | undefined,
  size: ParsedSize | null,
): string {
  const b = normalizeBrand(brand) || "nobrand";
  if (!size) return `${b}|nosize|1`;
  return `${b}|${size.value}${size.unit}|${size.multipack}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -c vitest.config.ts src/lib/productIdentity.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/productIdentity.ts src/lib/productIdentity.test.ts
git commit -m "feat(catalog): reduce written sizes to one comparable base unit"
```

---

### Task 2: Extraction schema and prompt

**Files:**
- Create: `src/scrapers/productExtraction.ts`
- Test: `src/scrapers/productExtraction.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `EXTRACTION_SCHEMA` (a JSON Schema object), `EXTRACTION_PROMPT: string`, and the type `ExtractedProduct = { brand: string | null; name: string; variant: string | null; sizeText: string | null; priceCents: number | null; originalPriceCents: number | null; promoLabel: string | null; confidence: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/scrapers/productExtraction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EXTRACTION_PROMPT, EXTRACTION_SCHEMA } from "./productExtraction";

// ---------------------------------------------------------------------------
// The schema is the contract with the model. Structured outputs reject any
// response that does not match it, so a wrong schema fails every page at once.
// ---------------------------------------------------------------------------

describe("EXTRACTION_SCHEMA", () => {
  it("requires additionalProperties false at every object level", () => {
    // Structured outputs reject schemas that allow extra keys.
    expect(EXTRACTION_SCHEMA.additionalProperties).toBe(false);
    const item = EXTRACTION_SCHEMA.properties.products.items;
    expect(item.additionalProperties).toBe(false);
  });

  it("asks for prices in integer cents, never floats", () => {
    const props = EXTRACTION_SCHEMA.properties.products.items.properties;
    expect(props.priceCents.type).toEqual(["integer", "null"]);
    expect(props.originalPriceCents.type).toEqual(["integer", "null"]);
  });

  it("requires every field so the model cannot silently omit one", () => {
    const item = EXTRACTION_SCHEMA.properties.products.items;
    expect(item.required).toEqual([
      "brand",
      "name",
      "variant",
      "sizeText",
      "priceCents",
      "originalPriceCents",
      "promoLabel",
      "confidence",
    ]);
  });
});

describe("EXTRACTION_PROMPT", () => {
  it("tells the model to omit rather than guess an unreadable price", () => {
    // A guessed price is worse than a missing one: it looks valid downstream.
    expect(EXTRACTION_PROMPT).toMatch(/null/);
    expect(EXTRACTION_PROMPT.toLowerCase()).toContain("do not guess");
  });

  it("names the cents convention explicitly", () => {
    expect(EXTRACTION_PROMPT).toContain("449");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -c vitest.config.ts src/scrapers/productExtraction.test.ts`
Expected: FAIL — cannot resolve `./productExtraction`.

- [ ] **Step 3: Write minimal implementation**

Create `src/scrapers/productExtraction.ts`:

```ts
export interface ExtractedProduct {
	brand: string | null;
	name: string;
	variant: string | null;
	sizeText: string | null;
	priceCents: number | null;
	originalPriceCents: number | null;
	promoLabel: string | null;
	confidence: number;
}

/* Cents rather than euros because floating point money silently rounds, and a
 * price that is wrong by a cent is a trust problem on a comparison site. */
export const EXTRACTION_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["products"],
	properties: {
		products: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"brand",
					"name",
					"variant",
					"sizeText",
					"priceCents",
					"originalPriceCents",
					"promoLabel",
					"confidence",
				],
				properties: {
					brand: { type: ["string", "null"] },
					name: { type: "string" },
					variant: { type: ["string", "null"] },
					sizeText: { type: ["string", "null"] },
					priceCents: { type: ["integer", "null"] },
					originalPriceCents: { type: ["integer", "null"] },
					promoLabel: { type: ["string", "null"] },
					confidence: { type: "number" },
				},
			},
		},
	},
} as const;

export const EXTRACTION_PROMPT = `Je krijgt één pagina uit een Belgische supermarktfolder.

Lijst elk product op dat een zichtbare prijs of promotie heeft.

Regels:
- priceCents en originalPriceCents zijn gehele getallen in eurocent. €4,49 is 449.
- Kun je een waarde niet duidelijk lezen? Gebruik null. Do not guess a price, a brand or a size — een verzonnen prijs is erger dan een ontbrekende prijs.
- sizeText is de inhoud exact zoals gedrukt, bijvoorbeeld "1,5 L" of "6 x 33 cl".
- promoLabel is de promotietekst zoals gedrukt, bijvoorbeeld "2+1 gratis" of "-30%".
- confidence is 0 tot 1: hoe zeker je bent dat naam én prijs correct gelezen zijn.
- Negeer winkelinformatie, openingsuren, algemene voorwaarden en reclame zonder prijs.`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -c vitest.config.ts src/scrapers/productExtraction.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/productExtraction.ts src/scrapers/productExtraction.test.ts
git commit -m "feat(extraction): define the leaflet product schema and prompt"
```

---

### Task 3: Extraction guard

Structured outputs guarantee the *shape* is valid. They guarantee nothing about the *values*. A hallucinated €0.01 price is schema-valid.

**Files:**
- Create: `src/lib/extractionGuard.ts`
- Test: `src/lib/extractionGuard.test.ts`

**Interfaces:**
- Consumes: `ExtractedProduct` from Task 2; `isPlausiblePrice` and `looksLikeOcrNoise` from `src/lib/dealValidation.ts`.
- Produces: `isPublishableProduct(p: ExtractedProduct): boolean`, `MIN_CONFIDENCE = 0.7`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/extractionGuard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isPublishableProduct, MIN_CONFIDENCE } from "./extractionGuard";
import type { ExtractedProduct } from "../scrapers/productExtraction";

function product(over: Partial<ExtractedProduct> = {}): ExtractedProduct {
  return {
    brand: "Coca-Cola",
    name: "Coca-Cola Zero",
    variant: null,
    sizeText: "1,5 L",
    priceCents: 149,
    originalPriceCents: 199,
    promoLabel: "-25%",
    confidence: 0.95,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// A model error looks plausible in a way OCR noise never did. These checks are
// the last gate before a wrong price reaches a page a shopper trusts.
// ---------------------------------------------------------------------------

describe("isPublishableProduct", () => {
  it("accepts a well-formed product", () => {
    expect(isPublishableProduct(product())).toBe(true);
  });

  it("rejects a product with no price", () => {
    expect(isPublishableProduct(product({ priceCents: null }))).toBe(false);
  });

  it("rejects an implausible price", () => {
    expect(isPublishableProduct(product({ priceCents: 0 }))).toBe(false);
    expect(isPublishableProduct(product({ priceCents: 500000 }))).toBe(false);
  });

  it("rejects a promo price above its own original price", () => {
    // Reading the two prices the wrong way round is a common layout error.
    expect(
      isPublishableProduct(product({ priceCents: 299, originalPriceCents: 199 })),
    ).toBe(false);
  });

  it("rejects low confidence", () => {
    expect(isPublishableProduct(product({ confidence: 0.4 }))).toBe(false);
  });

  it("rejects a name that is leaflet furniture rather than a product", () => {
    expect(isPublishableProduct(product({ name: "flessen" }))).toBe(false);
  });

  it("exposes the confidence floor for callers that queue rather than drop", () => {
    expect(MIN_CONFIDENCE).toBe(0.7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -c vitest.config.ts src/lib/extractionGuard.test.ts`
Expected: FAIL — cannot resolve `./extractionGuard`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/extractionGuard.ts`:

```ts
import type { ExtractedProduct } from "../scrapers/productExtraction";
import { isPlausiblePrice, looksLikeOcrNoise } from "./dealValidation";

/* Below this the extraction is queued for review rather than published. Set at
 * 0.7 because the model self-reports high confidence on clean cards and drops
 * sharply on cut-off or overlapping ones, which is exactly the split we want. */
export const MIN_CONFIDENCE = 0.7;

/* A handful of generic Dutch words appear as "product names" when a parser
 * grabs a category header instead of a product. They are never real names. */
const FURNITURE = new Set([
  "flessen",
  "stuks",
  "per stuk",
  "actie",
  "promo",
  "korting",
]);

export function isPublishableProduct(p: ExtractedProduct): boolean {
  if (p.priceCents == null) return false;

  // isPlausiblePrice works in euros; our storage unit is cents.
  if (!isPlausiblePrice(p.priceCents / 100)) return false;

  if (
    p.originalPriceCents != null &&
    p.originalPriceCents <= p.priceCents
  ) {
    return false;
  }

  if (p.confidence < MIN_CONFIDENCE) return false;

  const name = p.name?.trim() ?? "";
  if (name.length < 3) return false;
  if (FURNITURE.has(name.toLowerCase())) return false;
  if (looksLikeOcrNoise(name)) return false;

  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -c vitest.config.ts src/lib/extractionGuard.test.ts`
Expected: PASS — 7 tests.

If `isPlausiblePrice` rejects `1.49`, read `src/lib/dealValidation.ts:83` and adjust the test's sample prices to sit inside its accepted band rather than weakening the guard.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extractionGuard.ts src/lib/extractionGuard.test.ts
git commit -m "feat(extraction): gate model output on plausibility, not just schema"
```

---

### Task 4: Catalog schema and storage

**Files:**
- Create: `sql/002_create_catalog.sql`
- Create: `src/lib/catalogDb.ts`

**Interfaces:**
- Consumes: `ParsedSize` from Task 1.
- Produces: `findCanonicalByKey(key: string): Promise<CanonicalProduct | null>`, `insertCanonical(input: NewCanonical): Promise<string>`, `upsertOffer(input: NewOffer): Promise<void>`, `getComparableProducts(): Promise<ComparableProduct[]>`.

- [ ] **Step 1: Write the migration**

Create `sql/002_create_catalog.sql`:

```sql
-- Canonical products are the identity layer: one row per real-world product,
-- regardless of how many retailers sell it or how each one spells it.
CREATE TABLE IF NOT EXISTS canonical_products (
  id            TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS product_offers (
  id            BIGSERIAL PRIMARY KEY,
  canonical_id  TEXT NOT NULL REFERENCES canonical_products(id) ON DELETE CASCADE,
  retailer_slug TEXT NOT NULL,
  price_cents   INTEGER NOT NULL,
  original_price_cents INTEGER,
  promo_type    TEXT,
  promo_label   TEXT,
  valid_from    DATE NOT NULL,
  valid_until   DATE NOT NULL,
  folder_id     TEXT,
  source_page   INTEGER,
  confidence    REAL NOT NULL,
  scraped_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (canonical_id, retailer_slug, valid_from, valid_until)
);

CREATE INDEX IF NOT EXISTS idx_offers_canonical ON product_offers (canonical_id);
CREATE INDEX IF NOT EXISTS idx_offers_validity  ON product_offers (valid_until);
CREATE INDEX IF NOT EXISTS idx_canonical_status ON canonical_products (review_status);
```

- [ ] **Step 2: Write the storage layer**

Create `src/lib/catalogDb.ts`:

```ts
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
 * not a comparison, it is a thin page.
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
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `catalogDb.ts`.

- [ ] **Step 4: Commit**

```bash
git add sql/002_create_catalog.sql src/lib/catalogDb.ts
git commit -m "feat(catalog): add canonical product and offer storage"
```

---

### Task 5: Deterministic canonicalization

**Files:**
- Create: `src/lib/canonicalize.ts`
- Test: `src/lib/canonicalize.test.ts`

**Interfaces:**
- Consumes: `canonicalKey`, `parseSize` (Task 1); `ExtractedProduct` (Task 2); `findCanonicalByKey`, `insertCanonical` (Task 4).
- Produces: `toSlug(brand, name, size): string`, `resolveCanonical(p, deps): Promise<{ id: string; created: boolean }>` where `deps = { find: typeof findCanonicalByKey; insert: typeof insertCanonical }`.

Dependencies are injected so the resolution logic is testable without a database.

- [ ] **Step 1: Write the failing test**

Create `src/lib/canonicalize.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { resolveCanonical, toSlug } from "./canonicalize";
import type { ExtractedProduct } from "../scrapers/productExtraction";

function product(over: Partial<ExtractedProduct> = {}): ExtractedProduct {
  return {
    brand: "Coca-Cola",
    name: "Coca-Cola Zero",
    variant: null,
    sizeText: "1,5 L",
    priceCents: 149,
    originalPriceCents: 199,
    promoLabel: null,
    confidence: 0.9,
    ...over,
  };
}

describe("toSlug", () => {
  it("builds a url-safe slug from brand, name and size", () => {
    expect(toSlug("Coca-Cola", "Coca-Cola Zero", "1,5 L")).toBe(
      "coca-cola-zero-1-5-l",
    );
  });

  it("does not repeat the brand when the name already contains it", () => {
    expect(toSlug("Jupiler", "Jupiler Pils", "33 cl")).toBe("jupiler-pils-33-cl");
  });

  it("survives a missing brand and size", () => {
    expect(toSlug(null, "Bloemkool", null)).toBe("bloemkool");
  });
});

describe("resolveCanonical", () => {
  it("reuses an existing canonical product without inserting", async () => {
    const find = vi.fn().mockResolvedValue({ id: "existing-id" });
    const insert = vi.fn();

    const result = await resolveCanonical(product(), { find, insert });

    expect(result).toEqual({ id: "existing-id", created: false });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts a new canonical product on a miss", async () => {
    const find = vi.fn().mockResolvedValue(null);
    const insert = vi.fn().mockResolvedValue("new-id");

    const result = await resolveCanonical(product(), { find, insert });

    expect(result).toEqual({ id: "new-id", created: true });
    expect(insert).toHaveBeenCalledOnce();
  });

  it("looks up by the same key that two spellings of one product share", async () => {
    // This is the whole point: Delhaize and Colruyt write it differently.
    const find = vi.fn().mockResolvedValue(null);
    const insert = vi.fn().mockResolvedValue("id");

    await resolveCanonical(product({ name: "Coca Cola Zero", sizeText: "1.5l" }), {
      find,
      insert,
    });
    const firstKey = find.mock.calls[0][0];

    find.mockClear();
    await resolveCanonical(product({ name: "Coca-Cola Zero", sizeText: "1,5 L" }), {
      find,
      insert,
    });
    const secondKey = find.mock.calls[0][0];

    expect(firstKey).toBe(secondKey);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run -c vitest.config.ts src/lib/canonicalize.test.ts`
Expected: FAIL — cannot resolve `./canonicalize`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/canonicalize.ts`:

```ts
import type { ExtractedProduct } from "../scrapers/productExtraction";
import type { CanonicalProduct, NewCanonical } from "./catalogDb";
import { canonicalKey, normalizeBrand, parseSize } from "./productIdentity";

export interface CanonicalDeps {
  find: (key: string) => Promise<CanonicalProduct | null>;
  insert: (input: NewCanonical) => Promise<string>;
}

export function toSlug(
  brand: string | null | undefined,
  name: string,
  sizeText: string | null | undefined,
): string {
  const parts: string[] = [];

  // Only prefix the brand when the name does not already carry it, so we get
  // "jupiler-pils" rather than "jupiler-jupiler-pils".
  if (brand && !normalizeBrand(name).startsWith(normalizeBrand(brand))) {
    parts.push(brand);
  }
  parts.push(name);
  if (sizeText) parts.push(sizeText);

  return parts
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Tier one of matching: a normalized key lookup, no model call. Most weeks
 * repeat the previous week's products, so this absorbs the bulk of the volume
 * at zero cost and the catalog gets cheaper the longer it runs.
 */
export async function resolveCanonical(
  p: ExtractedProduct,
  deps: CanonicalDeps,
): Promise<{ id: string; created: boolean }> {
  const size = parseSize(p.sizeText);
  const key = canonicalKey(p.brand, size);

  const existing = await deps.find(key);
  if (existing) return { id: existing.id, created: false };

  const id = await deps.insert({
    canonicalKey: key,
    brand: p.brand,
    name: p.name,
    variant: p.variant,
    size,
    category: null,
    slug: toSlug(p.brand, p.name, p.sizeText),
  });

  return { id, created: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run -c vitest.config.ts src/lib/canonicalize.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/canonicalize.ts src/lib/canonicalize.test.ts
git commit -m "feat(catalog): resolve extracted products against the catalog"
```

---

### Task 6: Vision extraction via the Batch API

**Files:**
- Create: `src/scrapers/extractProductsFromImages.ts`
- Modify: `package.json` (add `@anthropic-ai/sdk`)
- Modify: `.env.example` (document `ANTHROPIC_API_KEY`)

**Interfaces:**
- Consumes: `EXTRACTION_SCHEMA`, `EXTRACTION_PROMPT`, `ExtractedProduct` (Task 2).
- Produces: `submitExtractionBatch(pages: PageRef[]): Promise<string>` returning a batch id; `collectExtractionBatch(batchId: string): Promise<Map<string, ExtractedProduct[]>>` keyed by `customId`. `PageRef = { customId: string; imageUrl: string }`.

- [ ] **Step 1: Install the SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Document the key**

Append to `.env.example`:

```
# --- Product extraction -----------------------------------------------------
# Vision extraction of leaflet pages runs on the Batch API. Without this key the
# extraction step is skipped and folders keep their existing text-parsed deals.
ANTHROPIC_API_KEY=
```

- [ ] **Step 3: Write the implementation**

Create `src/scrapers/extractProductsFromImages.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import {
	EXTRACTION_PROMPT,
	EXTRACTION_SCHEMA,
	type ExtractedProduct,
} from "./productExtraction";

export interface PageRef {
	/** Stable id we can map results back to: `${folderId}:${pageNumber}`. */
	customId: string;
	imageUrl: string;
}

const MODEL = "claude-sonnet-5";

function getClient(): Anthropic | null {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) return null;
	return new Anthropic({ apiKey });
}

/**
 * Leaflets refresh weekly and nobody is waiting on the result, so extraction
 * runs through the Batch API: same model, half the price. Returns the batch id
 * to poll later.
 */
export async function submitExtractionBatch(
	pages: PageRef[],
): Promise<string | null> {
	const client = getClient();
	if (!client || pages.length === 0) return null;

	const batch = await client.messages.batches.create({
		requests: pages.map((page) => ({
			custom_id: page.customId,
			params: {
				model: MODEL,
				max_tokens: 8000,
				output_config: {
					format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
				},
				messages: [
					{
						role: "user" as const,
						content: [
							{
								type: "image" as const,
								source: { type: "url" as const, url: page.imageUrl },
							},
							{ type: "text" as const, text: EXTRACTION_PROMPT },
						],
					},
				],
			},
		})),
	});

	return batch.id;
}

export async function isBatchReady(batchId: string): Promise<boolean> {
	const client = getClient();
	if (!client) return false;
	const batch = await client.messages.batches.retrieve(batchId);
	return batch.processing_status === "ended";
}

/**
 * Results arrive in any order, so they are keyed by custom_id rather than
 * position. A failed page yields no entry instead of an empty one, so callers
 * can tell "nothing on this page" from "this page did not run".
 */
export async function collectExtractionBatch(
	batchId: string,
): Promise<Map<string, ExtractedProduct[]>> {
	const client = getClient();
	const out = new Map<string, ExtractedProduct[]>();
	if (!client) return out;

	for await (const result of await client.messages.batches.results(batchId)) {
		if (result.result.type !== "succeeded") {
			console.error(
				`[extraction] page ${result.custom_id} failed: ${result.result.type}`,
			);
			continue;
		}

		const text = result.result.message.content.find((b) => b.type === "text");
		if (!text || text.type !== "text") continue;

		try {
			const parsed = JSON.parse(text.text) as { products: ExtractedProduct[] };
			out.set(result.custom_id, parsed.products ?? []);
		} catch (err) {
			console.error(`[extraction] page ${result.custom_id} unparseable:`, err);
		}
	}

	return out;
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `extractProductsFromImages.ts`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example src/scrapers/extractProductsFromImages.ts
git commit -m "feat(extraction): read leaflet pages with a vision model via batch"
```

---

### Task 7: The comparison page

**Files:**
- Create: `src/app/prijzen/[product]/page.tsx`
- Modify: `src/app/sitemap.ts`

**Interfaces:**
- Consumes: `getComparableProducts` (Task 4). Needs one more query, defined in Step 1.

- [ ] **Step 1: Add the per-product query**

Append to `src/lib/catalogDb.ts`:

```ts
export interface ProductOfferRow {
  retailer_slug: string;
  price_cents: number;
  original_price_cents: number | null;
  promo_label: string | null;
  valid_until: string;
  folder_id: string | null;
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
```

- [ ] **Step 2: Create the page**

Create `src/app/prijzen/[product]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getComparableProducts, getProductBySlug } from "@/lib/catalogDb";
import { getRetailerBySlug } from "@/lib/retailers";

export const revalidate = 3600;

export async function generateStaticParams() {
	const products = await getComparableProducts();
	return products.map((p) => ({ product: p.slug }));
}

function euro(cents: number): string {
	return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function title(p: { brand: string | null; name: string; variant: string | null }) {
	return [p.brand, p.name, p.variant].filter(Boolean).join(" ");
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ product: string }>;
}): Promise<Metadata> {
	const { product } = await params;
	const data = await getProductBySlug(product);
	if (!data) return { title: "Product niet gevonden" };

	const name = title(data.product);
	const cheapest = data.offers[0];
	return {
		title: `${name} prijs vergelijken — waar het goedkoopst?`,
		description: cheapest
			? `${name} is deze week vanaf ${euro(cheapest.price_cents)} in de folder. Vergelijk de prijs bij ${data.product.retailer_count} supermarkten.`
			: `Vergelijk de prijs van ${name} bij Belgische supermarkten.`,
		alternates: { canonical: `/prijzen/${product}` },
	};
}

export default async function ProductPage({
	params,
}: {
	params: Promise<{ product: string }>;
}) {
	const { product } = await params;
	const data = await getProductBySlug(product);
	if (!data) notFound();

	const name = title(data.product);
	const cheapest = data.offers[0];

	return (
		<div className="max-w-3xl mx-auto px-4 py-8">
			<h1 className="text-2xl font-bold text-gray-900 mb-2">
				{name} — waar het goedkoopst?
			</h1>
			<p className="text-gray-600 mb-6">
				Vergeleken bij {data.product.retailer_count} supermarkten op basis van de
				folders van deze week.
			</p>

			<table className="w-full border-collapse">
				<thead>
					<tr className="border-b border-gray-200 text-left text-sm text-gray-500">
						<th className="py-2">Winkel</th>
						<th className="py-2">Prijs</th>
						<th className="py-2">Promotie</th>
					</tr>
				</thead>
				<tbody>
					{data.offers.map((offer) => {
						const retailer = getRetailerBySlug(offer.retailer_slug);
						const isCheapest = offer.price_cents === cheapest.price_cents;
						return (
							<tr
								key={`${offer.retailer_slug}-${offer.valid_until}`}
								className="border-b border-gray-100"
							>
								<td className="py-3">
									<Link
										href={`/folders/${offer.retailer_slug}`}
										className="hover:underline"
									>
										{retailer?.name ?? offer.retailer_slug}
									</Link>
								</td>
								<td className="py-3 font-semibold tabular-nums">
									{euro(offer.price_cents)}
									{isCheapest && (
										<span className="ml-2 text-xs font-medium text-green-700">
											goedkoopst
										</span>
									)}
								</td>
								<td className="py-3 text-sm text-gray-600">
									{offer.promo_label ?? "—"}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
```

- [ ] **Step 3: Verify the retailer helper exists**

Run: `grep -n "export function getRetailerBySlug" src/lib/retailers.ts`
Expected: one match. If it does not exist, find the equivalent lookup in that file and use its real name — do not invent one.

- [ ] **Step 4: Add the routes to the sitemap**

In `src/app/sitemap.ts`, import `getComparableProducts` from `@/lib/catalogDb` and append to the returned array:

```ts
	const comparable = await getComparableProducts();
	const priceRoutes = comparable.map((p) => ({
		url: `${baseUrl}/prijzen/${p.slug}`,
		lastModified: new Date(),
		changeFrequency: "weekly" as const,
		priority: 0.7,
	}));
```

`baseUrl` is the existing variable at `src/app/sitemap.ts:11` (`const baseUrl = getSiteBaseUrl()`). Then include `...priceRoutes` in the returned array.

- [ ] **Step 5: Verify the build**

Run: `rm -rf .next && npm run build`
Expected: build succeeds; `/prijzen/[product]` appears in the route list.

A stale `.next` directory causes an unrelated type error in `.next/dev/types/validator.ts`, which is why the build starts by clearing it.

- [ ] **Step 6: Commit**

```bash
git add src/app/prijzen src/app/sitemap.ts src/lib/catalogDb.ts
git commit -m "feat(prijzen): publish per-product price comparison pages"
```

---

## Self-Review

**Spec coverage.** Extraction → Tasks 2, 6. Canonicalization → Tasks 1, 5. Storage → Task 4. Presentation → Task 7. The ≥2-retailer rule → Task 4 (`getComparableProducts` HAVING clause) and Task 7. The review queue → Task 4 (`review_status`). Plausibility guard → Task 3. Multi-buy promos are stored as `promo_label`/`promo_type` and rendered verbatim in Task 7 rather than reduced to a unit price.

**Not covered by a task, deliberately:** wiring extraction into the weekly scraper run, and the `/inspector` review UI. Both need the pipeline to exist and produce rows first; they are the natural follow-up plan once Task 7 lands and there is real data to look at.

**Type consistency.** `ExtractedProduct` is defined once in Task 2 and imported by Tasks 3, 5, 6. `ParsedSize` is defined in Task 1 and imported by Tasks 4, 5. `CanonicalProduct`/`NewCanonical` are defined in Task 4 and imported by Task 5. `ComparableProduct` is defined in Task 4 and used in Tasks 4 and 7. Prices are `priceCents: number` (integer cents) in every task.
