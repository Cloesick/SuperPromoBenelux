import type { ExtractedProduct } from "../scrapers/productExtraction";
import { isPlausiblePrice, looksLikeOcrNoise } from "./dealValidation";

/* Below this the extraction is queued for review rather than published. Set at
 * 0.7 because the model self-reports high confidence on clean product cards and
 * drops sharply on cut-off or overlapping ones, which is exactly the split we
 * want to act on. */
export const MIN_CONFIDENCE = 0.7;

/* Generic Dutch words that appear as "product names" when an extractor grabs a
 * category header or a packaging noun instead of the product. "flessen" is what
 * the current Colruyt pipeline produces; none of these are ever real names. */
const FURNITURE = new Set([
  "flessen",
  "stuks",
  "per stuk",
  "actie",
  "promo",
  "korting",
  "voordeel",
]);

/**
 * The last gate before a price reaches a page. Structured outputs guarantee the
 * shape of the model's answer and nothing about its truth: a hallucinated price
 * is schema-valid, well-formed, and wrong.
 */
export function isPublishableProduct(p: ExtractedProduct): boolean {
  if (p.priceCents == null) return false;

  // isPlausiblePrice works in euros; our storage unit is integer cents.
  if (!isPlausiblePrice(p.priceCents / 100)) return false;

  // A promo price at or above the original means the two were read the wrong
  // way round, which is a common failure on stacked price layouts.
  if (p.originalPriceCents != null && p.originalPriceCents <= p.priceCents) {
    return false;
  }

  if (p.confidence < MIN_CONFIDENCE) return false;

  const name = p.name?.trim() ?? "";
  if (name.length < 3) return false;
  if (FURNITURE.has(name.toLowerCase())) return false;
  if (looksLikeOcrNoise(name)) return false;

  return true;
}
