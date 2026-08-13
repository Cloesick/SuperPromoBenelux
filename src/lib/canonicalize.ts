import type { ExtractedProduct } from "../scrapers/productExtraction";
import type { CanonicalProduct, NewCanonical } from "./catalogDb";
import { canonicalKey, normalizeBrand, parseSize } from "./productIdentity";

/* Injected rather than imported directly so the resolution logic can be tested
 * without a database. */
export interface CanonicalDeps {
  find: (key: string) => Promise<CanonicalProduct | null>;
  insert: (input: NewCanonical) => Promise<string>;
}

const COMBINING_MARKS = /[̀-ͯ]/g;

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
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Tier one of matching: a normalized key lookup, no model call.
 *
 * Most weeks repeat the previous week's products, so this absorbs the bulk of
 * the volume at zero cost and the catalog gets cheaper the longer it runs. The
 * model is only needed for genuinely new items, which is what makes the catalog
 * an asset that compounds rather than a per-run expense.
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
