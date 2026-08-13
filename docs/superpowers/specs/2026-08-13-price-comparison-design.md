# Cross-retailer price comparison — design

Date: 2026-08-13
Status: approved, not yet implemented

## Problem

The site aggregates supermarket leaflets but has no comparable price data. Two
things are missing, and the second is the harder one.

**Prices are largely absent or unusable.** Measured against the current scraped
output:

| Retailer | Deals | With a price | Product names |
| --- | ---: | ---: | --- |
| Albert Heijn | 5 | 0 | — |
| Delhaize | 20 | 0 | — |
| Lidl | 5 | 2 | non-grocery (clogs, carpet cleaner) |
| Colruyt | 50 | 50 | `"flessen"`, `"Jimmy's gof g"`, `"Kentucky Bourbon Whiskey d"` |
| ALDI | 6 | 6 | usable but verbose |

The live homepage contains zero price strings. Two of the five largest chains
yield no prices at all, and the chain that does yield prices produces names that
cannot be matched to anything.

**There is no product identity.** `Deal` carries a free-text `product` string
and no brand, size, or unit. Comparison fundamentally requires deciding that a
product at one retailer is the same product at another; nothing in the current
model supports that.

### Root cause — corrected 2026-08-13

An earlier draft of this spec blamed PDF text flattening in
`extractDealsFromText.ts` (`content.items.map(str).join(" ")` destroying the
spatial adjacency between a product and its price) plus its
`Math.min(doc.numPages, 12)` page cap. That explains why PDF-derived *names* are
poor. **It is not why Albert Heijn, Delhaize and Spar have zero prices.**

The operative cause is a gate in the `base.ts` fallback chain:

```ts
const usableDealCount = () => sanitizeDeals(allDeals).kept.length;
if (usableDealCount() === 0 && pages > 0 && isLeafletCapture) { /* run OCR */ }
```

`usableDealCount()` counts deals that survive sanitization **regardless of
whether any carry a price**. For the publitas retailers the PDF pass reliably
returns name-only rows; those rows are "usable", so the counter is non-zero, the
gate closes, and the leaflet OCR that would have read the prices never runs.

The evidence is a clean split rather than a hunch:

| Retailer | methods | OCR ran | Priced |
| --- | --- | --- | ---: |
| Colruyt | issuu, screenshot, ocr | yes | 50/50 |
| ALDI | ipaper, screenshot, ocr | yes | 6/6 |
| Albert Heijn | publitas, pdf, screenshot | no | 0 |
| Delhaize | publitas, pdf, screenshot | no | 0 |
| Spar | publitas, pdf | no | 0 |

Colruyt and ALDI are not better configured — they are the two whose PDF pass
found *nothing*, which is what let them fall through to OCR. Succeeding at PDF is
what costs a retailer its prices.

Fixed in `dd8294b` by gating on priced deals instead. Finding names should never
block the step that finds prices. One gap remains: Lidl has 2 priced deals across
40 pages, so its count is non-zero and OCR stays blocked there — a ratio-based
gate would catch it, at the risk of re-running OCR over good data.

This does not change the design below. It raises the floor the vision pipeline
starts from, and makes the vision work a quality upgrade rather than a rescue.
`dealValidation.ts` (`looksLikeOcrNoise`, `isLeafletFragment`, `salvageDeal`)
remains sound and is retained as the guard.

## Goals

- Extract clean, structured product data (brand, name, variant, size, unit,
  price) from leaflet pages for the major grocery chains.
- Establish a canonical product identity so the same product can be recognized
  across retailers.
- Publish per-product comparison pages that answer "where is X cheapest this
  week?".

## Non-goals (deliberate, revisit later)

- Basket comparison, price history, and price alerts. All become straightforward
  once the catalog and offers exist, but each needs weeks of accumulated data,
  so none can launch first.
- Non-grocery retailers (Action, Brico, MediaMarkt, …). Price comparison across
  them is not meaningful; their folder pages are unaffected by this work.

## Scope

Six grocery chains whose leaflets are already captured: **Albert Heijn, ALDI,
Colruyt, Delhaize, Lidl, Spar**.

Spar is included even though **it has no scraper at all** — it is not among the
33 registered in `src/scrapers/scrapers.ts`, and `npm run scrape spar` answers
`Ignoring 1 unknown slug(s): spar`. Its 16 captured pages arrive by another route
(Apify, per `docs/CONNECTORS.md`).

That is the clearest demonstration of the property this design leans on: the
vision pipeline reads leaflet *page images*, not scraper output, so a retailer
with pages and no parser is fully covered. **Extraction coverage is bounded by
folder capture, not by per-retailer parser quality** — which is why adding a
retailer costs a capture route rather than a new bespoke parser.

**Carrefour is out of scope for v1.** It has no scraper and no captured folders
(`data/folders/` has no entry), so including it would require new folder-capture
work that is unrelated to price extraction. Add it as a separate piece of work if
wanted; nothing in this design blocks that.

## Architecture

```
leaflet page images ──▶ [1] extract ──▶ [2] canonicalize ──▶ [3] store ──▶ [4] serve
   (already captured)     Sonnet 5        deterministic       Postgres    /prijzen/[product]
                          Batch API       → LLM fallback
```

### [1] Extraction — `src/scrapers/extractProductsFromImages.ts` (new)

Sends already-captured leaflet page images to Claude Sonnet 5 via the **Batch
API**, using `output_config.format` with a JSON schema so responses are
schema-valid by construction.

Why a vision model rather than better geometric parsing: the failure is
*semantic grouping* of a visual layout. A model that sees the page groups a
product card the way a shopper does, without per-retailer layout heuristics that
break whenever a chain redesigns its leaflet.

Why Sonnet 5 specifically:

- **High-resolution vision (2576 px long edge).** Haiku 4.5 predates high-res
  and caps at 1568 px. Leaflets are dense, with small price text and superscript
  cents — resolution is the binding constraint.
- **Structured outputs** remove the parse-and-salvage step on the extraction
  path.
- **Batch API** matches the weekly cadence and halves the price. This workload is
  not latency-sensitive; there is no reason to pay interactive rates.

Cost at ~250 pages/week is roughly $15/month — small enough that model choice
should be made on accuracy, not price.

Per-product output fields: `brand`, `name`, `variant`, `size`, `unit`, `price`,
`originalPrice`, `promoLabel`, `confidence`.

This replaces `extractDealsFromText.ts` for the six in-scope retailers and
removes the 12-page cap so whole leaflets are read. Other retailers keep the
existing text path.

### [2] Canonicalization — `src/lib/canonicalize.ts` (new)

Two tiers, in order:

1. **Deterministic.** Normalize `brand + size + unit` into a key and look it up
   in the catalog. On a hit, done — no model call.
2. **LLM fallback, only on a miss.** Pass the extracted product plus the top
   candidate catalog entries to the model, which either selects one or proposes
   a new entry.

Most weeks repeat the previous week's products, so tier 1 absorbs the bulk of
the volume at steady state and per-week cost stays near zero. The catalog is the
asset that compounds: every resolved match makes the next week cheaper and more
accurate.

New entries and low-confidence matches go to a review queue rather than straight
to publication. Concretely, the queue is a `review_status` column on
`canonical_products` (`pending` | `approved` | `rejected`), surfaced through the
existing `/inspector` route. Only `approved` entries are eligible to appear on a
public page; `pending` entries still accumulate offers, so approving one later
backfills its history rather than starting it from zero. There is no separate
queue service, and no new admin surface is built for v1.

### [3] Storage — extends the existing Neon Postgres setup

```sql
canonical_products (id, brand, name, variant, size, unit, category, aliases[])
product_offers     (canonical_id, retailer_slug, price, unit_price,
                    promo_type, valid_from, valid_until, folder_id, source_page)
```

`dealValidation.ts` is retained and repurposed as a post-extraction guard —
`isPlausiblePrice` and `looksLikeOcrNoise` are the last line of defense against a
hallucinated price reaching a page.

### [4] Presentation — `/prijzen/[product]`

Statically generated per canonical product via `generateStaticParams`. Each page
shows a price-per-retailer table with the cheapest highlighted, and links each
row to that retailer's folder page. `Product` + `Offer` JSON-LD via the existing
`JsonLd` component, plus sitemap entries.

## Design decisions

**Publish only with two or more retailers.** A comparison page showing one price
is not a comparison; it is a thin page that dilutes the domain. This mirrors the
existing `isFolderIndexable` rule added after albert-heijn and lidl put
render-nothing pages into the sitemap at weekly priority 0.8.

**A wrong price is worse than a missing one.** The product is a trust promise.
Low-confidence extractions and newly-proposed catalog entries are queued for
review instead of published. Precision over coverage, especially early.

**Multi-buy promotions are not flattened.** "2+1 gratis" and "50% op de tweede"
have no single comparable unit price. `promo_type` is stored explicitly and
rendered as-is rather than being silently reduced to a misleading per-unit
figure. `inferPromoType` in `productsDb.ts` already classifies these.

## Rollout

1. Extraction for the six chains, writing to `product_offers` with no public
   pages. Verify precision against leaflets by hand.
2. Canonicalization plus the review queue. Let the catalog build.
3. Publish `/prijzen/[product]` for canonical products with two or more
   retailer offers.

## Risks

**Coverage is thin at first.** The catalog needs several weeks of leaflets
before enough products carry offers from two or more retailers. The first run
will produce very few publishable pages — that is the system working correctly,
not failing. Judge precision at week one and coverage at week four.

**Model extraction errors are plausible-looking.** Unlike OCR noise, a
hallucinated price reads as valid. This is why `isPlausiblePrice` stays in the
path, why confidence is stored per product, and why the ≥2-retailer rule matters:
a second independent observation of a similar price range is corroboration.

**Leaflet layout changes.** A vision model degrades gracefully where geometric
heuristics break outright, but extraction quality should be monitored per
retailer per week rather than assumed stable.
